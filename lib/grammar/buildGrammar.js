/**
 * Usage
 *   node buildGrammar [options]
 *
 * Description
 *   Generates and outputs the grammar containing the grammar rules, semantics, entities, and
 *   deletables.
 *
 * Options
 *   -o, --output       Write output to a given path/filename.       [string] [default: "grammar.json"]
 *   -t, --trees        Include the insertion rules' parse trees in the grammar.              [boolean]
 *   -u, --warn-unused  Print warnings for unused grammar components.                         [boolean]
 *   -q, --quiet        Suppress all non-error messages from output.                          [boolean]
 *   -h, --help         Display this screen.                                                  [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Generates and outputs the grammar containing the grammar rules, semantics, entities, and deletables.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'o': {
			alias: 'output',
			description: 'Write output to a given path/filename.',
			requiresArg: true,
			type: 'string',
			default: 'grammar.json',
		},
		't': {
			alias: 'trees',
			description: 'Include the insertion rules\' parse trees in the grammar.',
			type: 'boolean',
		},
		'u': {
			alias: 'warn-unused',
			description: 'Print warnings for unused grammar components.',
			type: 'boolean',
		},
		'q': {
			alias: 'quiet',
			description: 'Suppress all non-error messages from output.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

// Start a CPU profile if run via `devtool`, which runs the program inside Chrome DevTools.
var isDevtool = !!console.profile
if (isDevtool) {
	console.profile('buildGrammar')
}

// Modify stack trace format to stylize output when printing.
util.prettifyStackTrace()

util.log('Building grammar' + (argv.trees ? ' with trees' : '') + '...')

// Instantiate grammar.
var g = require('./grammar')

// Add rules to grammar.
require('./rules/user/user')
require('./rules/github/github')
require('./rules/company/company')

// Add deletables to grammar.
require('./deletables')

// Compile and check the grammar after adding all non-edit rules.
g.compileGrammar()

if (!argv.quiet) {
	// Print the number of rules and entities in the grammar.
	g.printStats(argv.output)

	// Print values of any counters used during grammar generation.
	util.countEndAll()
}

// If run via `devtool`, complete CPU profile and print report to the Profiles panel (inside Chrome DevTools).
if (isDevtool) {
	console.profileEnd('buildGrammar')
} else {
	// Write the grammar to a file.
	g.writeGrammarToFile(argv.output)
}