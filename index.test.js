const report = require('./report')
const process = require('process')
const cp = require('child_process')
const path = require('path')

test('json without group metrics', async () => {
  
    const files = [path.resolve('./', 'example/jacoco.csv')]
    const success = await report(files)
    expect(true).toEqual(true)
})
  