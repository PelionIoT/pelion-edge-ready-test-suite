var assert = require('chai').assert

describe('#test', function() {
    it("return true", async function() {
        await setTimeout(function() {this.retries(1)}, 5000)
        // this.retries()
        console.log("re")
        assert.equal(2,3)
    })
})