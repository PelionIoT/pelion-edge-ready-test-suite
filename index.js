/*
 * Copyright (c) 2020-2021, Pelion and affiliates.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const version = "2.2.0"

var Mocha = require('mocha');
var fs = require('fs');
var jsonminify = require('jsonminify');
var program = require('commander');
var createVirtualDevices = require('./utils/createVirtualDevices.js');
var xml_builder = require('junit-report-builder');

program
    .version(version)
    .option ('-c, --configuration [file]','specify the configuration file [config.json]','config.json')
    .option ('-v, --virtual_device_create [create]','create virtual devices')
    .option ('-e, --export [treasure]','export to csv and xml')
    .allowUnknownOption()
    .parse(process.argv);

global.config = JSON.parse(jsonminify(fs.readFileSync(program.configuration, 'utf8')));

var Logger = require('./utils/logger');
var logger = new Logger( { moduleName: '', color: 'green'} );
global.SQALogLevel = config.log_level || 2;

let suiteReport = {
    "title": config.title,
    "relayID": require('./utils/getRelayID.js')('/userdata/edge_gw_config/identity.json'),
    "softwareBuild": require('./utils/getSoftwareBuildVersion.js')('/wigwag/etc/versions.json'),
    "hardwareVersion": require('./utils/getHardwareVersion.js')('/userdata/edge_gw_config/identity.json'),
    "radioConfig": require('./utils/getRadioConfig.js')('/userdata/edge_gw_config/identity.json'),
    "ipAddress": require('./utils/getNetworkAddress')(),
    "status": "STARTING",
    "startTime": "",
    "endTime": "",
    "totalTime": "",
    "totalTestCasesRan": 0,
    "totalFailedTestCases": 0,
    "totalPassedTestCases": 0,
    "tests": [],
};

var exportToCSVAndXML = (code) => {
    if(code == 1) {
        suiteReport.status = 'UNSTABLE';
    } else {
        suiteReport.status = 'STABLE';
    }

    var td_json_report = JSON.parse(jsonminify(fs.readFileSync('suite_reports/perts_mocha_suite_report.json', 'utf8')));

    suiteReport.totalTestCasesRan = td_json_report.stats.tests
    suiteReport.totalPassedTestCases = td_json_report.stats.passes
    suiteReport.totalFailedTestCases = td_json_report.stats.failures
    suiteReport.startTime = td_json_report.stats.start
    suiteReport.endTime = td_json_report.stats.end
    suiteReport.totalTime = td_json_report.stats.duration

    td_json_report.results.forEach(suites => {
        suites.suites.forEach((subsuites) => {
            subsuites.suites.forEach((suite) => {
                suite.tests.forEach((test) => {
                    test.fullFile = suite.fullFile
                    suiteReport.tests.push(test)
                })
            })
        })
    });
    fs.writeFileSync('./suite_reports/perts_exported_report.json', JSON.stringify(suiteReport, null, 4));

    let suiteReportCSV
    let testcase_id_counter = 0;
    let xml_result = ""
    let suiteName = ""
    Object.keys(suiteReport).forEach(function(key) {
        if(key !== 'tests') {
            suiteReportCSV += key + ',' + suiteReport[key] + '\n';
        } else {
            //in categories
            var suite = xml_builder.testSuite().name(config.title).timestamp(new Date())
            suiteReportCSV += 'Functional Area,Level,Test Case ID,Category,Test Case,File Path,Automation Status,Automation Execution Time(ms),Error,Error Log\n';
                suiteReport[key].forEach(function(test) {

                    var fullTitleArr = test.fullTitle.split(' ')
                    var level = fullTitleArr[0].replace("[", "") + fullTitleArr[1].replace("]", "")
                    var cat = fullTitleArr[2]
                    var functional_area = fullTitleArr[3]
                    var testsuite_name = level + ' ' + cat

                    if(suiteName !== testsuite_name) {
                        suite = xml_builder.testSuite().name(testsuite_name).timestamp(new Date());
                        suiteName = testsuite_name
                    }

                    if(!test.fail) {
                        xml_result = suite.testCase()
                            .className(test.fullTitle)
                            .name(test.title)
                            .time(test.duration);
                        test.status = "PASSED"
                    } else {
                        test.status = "FAILED"
                        if(test.err.message) {
                            test.err.message = test.err.message.replace(/[\n,]/g, "")
                        }
                        xml_result = suite.testCase()
                            .className(test.fullTitle)
                            .name(test.title)
                            .time(test.duration)
                            .failure(test.err.message);
                    }
                    suiteReportCSV += (functional_area || '--') + ',' + (level || '--') + ',' + level+'-'+testcase_id_counter +','  + cat + ',' +
                    test.title + ',' + test.fullFile + ',' + test.status + ',' +
                    (test.duration || '--') + ',' + (test.err.message || '--') + ',' +
                    (test.err.stack || '--') + '\n';
                    testcase_id_counter++
                });
        }
    });
    fs.writeFileSync('./suite_reports/perts_exported_report.csv', suiteReportCSV);
    logger.info('CSV formatted report generated and saved as- ' + './suite_reports/perts_exported_report.csv');
    xml_builder.writeTo('./suite_reports/perts_exported_report.xml');
    logger.info('XML formatted report generated and saved as- ' + './suite_reports/perts_exported_report.xml');
    process.exit(code)
}

var execute = () => {
    var mocha = new Mocha({
        reporter: 'mochawesome',
        reporterOptions: {
            reportDir: 'suite_reports',
            reportFilename: "perts_mocha_suite_report"
          }
    });

    config.test_cases.forEach(function(file) {
        if(fs.existsSync(file)) {
            mocha.addFile(file);
        }else {
            logger.error("Testcase path " + file + " not found")
        }
    });

    mocha.globals().suite._timeout = config.mocha_timeout

    var code = 0;
    mocha.run(function(failures) {
        if(failures) code = 1;
        if(program.export) {
            exportToCSVAndXML(code)
        } else  {
            process.exit(code)
        }
    })
}

let start = () => {
    if(program.virtual_device_create) {
        createVirtualDevices().then(function() {
            logger.info("Created virtual devices.")
            execute()
        },function(err) {
            logger.error('Failed to create virtual devices '+ err);
            process.exit(1);
        })
    }else {
        execute()
    }
}
start()
