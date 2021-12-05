const core = require('@actions/core')
const report = require('./report')

async function run () {
  try {
    const resultPaths = core.getInput('paths')
    const reportPaths = resultPaths.split(",");
    const minCoverage = parseFloat(
      core.getInput("min-coverage")
    );
    await report(reportPaths, minCoverage)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()

