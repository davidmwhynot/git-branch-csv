import {Command, flags} from '@oclif/command'
import simpleGit, {
  BranchSummary,
  SimpleGit,
  SimpleGitOptions,
} from 'simple-git'
import {resolve} from 'path'
import {writeFileSync} from 'fs'

type CSVLine = [
  string, // fullName
  string, // name
  string, // isRemote
  string, // remoteName
  string, // commit
  string // label
];

const summaryToCSV = (summary: BranchSummary): string => {
  const header: CSVLine = [
    'fullName',
    'name',
    'isRemote',
    'remoteName',
    'commit',
    'label',
  ]
  const buffer: string[] = [header.join(',')]

  for (const [fullName, {commit, label}] of Object.entries(
    summary.branches
  )) {
    const tokens = fullName.split('/')

    let name: string
    let isRemote = 'false'
    let remoteName = 'null'

    if (tokens.length >= 3) {
      const [remotes, parsedRemoteName, ...rest] = tokens

      if (remotes === 'remotes') {
        isRemote = 'true'
        remoteName = parsedRemoteName
        name = rest.join('/')
      } else {
        name = fullName
      }
    } else {
      name = tokens.join('/')
    }

    buffer.push(
      [fullName, name, isRemote, remoteName, commit, `"${label.replace(/["\n]/, '')}"`].join(',')
    )
  }

  return buffer.join('\n')
}

type Format = 'csv' | 'json';

const options: Partial<SimpleGitOptions> = {
  baseDir: process.cwd(),
  binary: 'git',
  maxConcurrentProcesses: 6,
}

class GitBranchCsv extends Command {
  static description =
    'Generate a csv file with data about the branches for the git repo in the current directory. You can also optionally specify a different directory to get the info from.';

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    directory: flags.string({
      char: 'd',
      description:
        '[default: current working directory] Directory to read branch info from.',
    }),
    noWrite: flags.boolean({
      char: 'n',
      description: 'Do not write output to a file. Just log to stdout.',
      default: false,
    }),
    output: flags.string({
      char: 'o',
      description: 'Path to a file to write the output to.',
      default: 'branches.csv',
    }),
    format: flags.enum<Format>({
      char: 'f',
      description: 'Change the type of file that will be generated',
      options: ['csv', 'json'],
      default: 'csv',
    }),
  };

  async run() {
    const {flags} = this.parse(GitBranchCsv)

    const {directory = process.cwd(), noWrite, output, format} = flags

    options.baseDir = directory

    const git: SimpleGit = simpleGit(options)

    const summary = await git.branch(['-a', '-vv'])

    let data: string
    let otherFormat: Format

    switch (format) {
    case 'csv':
      otherFormat = 'json'
      data = summaryToCSV(summary)

      break
    case 'json':
      otherFormat = 'csv'
      data = JSON.stringify(summary, null, '\t')
    }

    if (noWrite) {
      this.log(data)

      return
    }

    let outPath = output

    const dotFormat = `.${format}`
    const dotOtherFormat = `.${otherFormat}`

    if (outPath.endsWith(dotOtherFormat)) {
      outPath = outPath.substring(0, outPath.lastIndexOf(dotOtherFormat))
    }

    if (!outPath.endsWith(dotFormat)) {
      outPath += dotFormat
    }

    writeFileSync(resolve(outPath), data)
  }
}

export = GitBranchCsv;
