const core = require('@actions/core')
const table = require('markdown-table')
const replaceComment = require('@aki77/actions-replace-comment')
const github = require('@actions/github')
const fs = require('fs')
const csv = require('csv-parser')

const report = async(files, threshold) => {
    const moduleCoverage  = await filterReport(files)
    const overAllCoverage = await overallCoverage(moduleCoverage)
    
    const pullRequestId = github.context.issue.number
    if (pullRequestId) {
        await markdownTable(pullRequestId, moduleCoverage, overAllCoverage, threshold)
    }
    await checkCoverageThreshold(overAllCoverage, threshold)
}       

const checkCoverageThreshold = async(overAllCoverage, threshold) => {
    const percentage = parseFloat(overAllCoverage['line_percent'])
    threshold = parseFloat(threshold)
    if (percentage < threshold) {
        core.setFailed(`Coverage of ${percentage} is below passing threshold of ${threshold}`)
        return false
    }
    core.info(`Coverage is above passing threshod - ${percentage}`)
    return true
}

const markdownTable = async(prNumber, moduleCoverage, overAllCoverage, threshold) => {
    const header = [
        'Category',
        'Percentage',
        'Covered / Total'
    ]
    
    const percentage = parseFloat(overAllCoverage['line_percent']).toFixed(2)
    const metrics = [
        '**Total**',
        `**${percentage}**`,
        `**${overAllCoverage['line_covered']} / ${overAllCoverage['line_total']}**`
    ]

    const coverageList = moduleCoverage.map((module) => {
        return [
          module['component'],
          parseFloat(module['line_percent']).toFixed(3),
          `${module['line_covered']} / ${module['line_total']}`
        ]
    })

    const tableText = table([header, ...coverageList, metrics])
    const headerText = "## Jacoco Coverage :rocket:"
    let failedText = null
    if (percentage < threshold) {
        failedText = `:x: Coverage of ${percentage} is below passing threshold of ${threshold}`
    }
    const bodyText = [headerText, failedText, tableText].filter(Boolean).join("\n");

    await replaceComment.default({
        token: core.getInput('token', { required: true }),
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        body: bodyText
    })
}

const overallCoverage = async(result) => {
    const report = {
        'report': 'Total', 'line_percent': 0.0,
        'line_total': 0, 'line_covered': 0, 'line_missed': 0
    }
    result.forEach(row => {
        report['line_total'] += row['line_total']
        report['line_covered'] += row['line_covered']
        report['line_missed'] += row['line_missed']
    })
    report['line_percent'] = 
        parseFloat(report['line_covered']) / parseFloat(report['line_total']) * 100.0
    return report
}

const filterReport = async(files) => {
    const output = []
    await Promise.all(files.map(async (file) => {
        await parseFile(file).then(result => {
            Object.entries(result).forEach(([key, value]) => {
                let line_covered = value['line_covered']
                let line_missed  = value['line_missed']
                let line_total   = line_covered + line_missed
                let line_percent = parseFloat(line_covered) /  parseFloat(line_total) * 100.0
                output.push({
                    'component': key, 
                    'line_percent': line_percent,
                    'line_total': line_total,
                    ...value
                })
            })
        }).catch(error => { 
            core.setFailed(error.message)
        })
    }))
    return output
}

const parseFile = async(file) => {
    let data = {}
    let results = []
    const promise = new Promise((resolve, reject) => {
        fs.createReadStream(file)
            .pipe(csv())
            .on('data', async(rows) => results.push(rows))
            .on('error', () => reject())
            .on('end', async() => {
                results.forEach( (row, index) => {
                    let group = row.GROUP
                    if (group.indexOf('/') != -1) {
                        let groups = group.split('/')
                        group = groups.pop()
                    }
                    if (data[group] == undefined) {
                        data[group] = {'line_covered': 0, 'line_missed': 0}
                    }
                    data[group]['line_covered'] += parseInt(row.LINE_COVERED)
                    data[group]['line_missed'] += parseInt(row.LINE_MISSED)
                })
                resolve(data)
            })
    })
    return await promise
}

module.exports = report
