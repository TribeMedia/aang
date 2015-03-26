// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}

var grammar = require('../grammar.json')

var prevRSS = process.memoryUsage().rss
var stateTable = new (require('./StateTable'))(grammar, '[start]')
// console.log((process.memoryUsage().rss - prevRSS) / 1e6 + ' MB')
// stateTable.print()

var readline = require('readline')
var rl = readline.createInterface(process.stdin, process.stdout)

rl.prompt()
rl.write('people who like my repos liked by people who follow people I follow')

var parserNewPath = './Parser.js'
var parserOldPath = './util/ParserBreadthFirst.js'

rl.on('line', function (line) {
	var query = line.trim()

	if (query && !parseCommand(query)) {
		try {
			console.log('query:', query)
			var parser = new (require(parserPath))(stateTable)

			if (printTime) console.time('parse')
			parser.parse(query)
			if (printTime) console.timeEnd('parse')

			var parserOld = new (require(parserOldPath))(stateTable)
			parserOld.parse(query)
			require('./util/diffParses')(parserOld, parser)

			if (!parser.startNode) console.log('Failed to reach start node')

			if (printForest) parser.printForest()
			if (printStack) parser.printStack()
			if (printGraph && parser.startNode) parser.printNodeGraph(parser.startNode)
		} catch (e) {
			console.log()
			// Remove parentheses from stack for iTerm open-file shortcut
			e.stack.split('\n').forEach(function (stackLine) {
				console.log(stackLine.replace(/[()]/g, ''))
			})
		}

		delete require.cache[require.resolve(parserPath)]
		delete require.cache[require.resolve('./util/diffParses.js')]
		delete require.cache[require.resolve('./util/ParserBreadthFirst.js')]
		delete require.cache[require.resolve('./BinaryHeap.js')]
	}

	rl.prompt()
})


var printTime = false
var printStack = false
var printForest = false
var printGraph = false
var parserPath = parserNewPath

function parseCommand(query) {
	if (query === '-t') {
		printTime = !printTime
		console.log('print time:', printTime)
	} else if (query === '-s') {
		printStack = !printStack
		console.log('print stack:', printStack)
	} else if (query === '-f') {
		printForest = !printForest
		console.log('print forest:', printForest)
	} else if (query === '-g') {
		printGraph = !printGraph
		console.log('print graph:', printGraph)
	} else if (query === '-p') {
		parserPath = parserPath === parserNewPath ? parserOldPath : parserNewPath
		console.log('parser path:', parserPath)
	} else if (query === '-h') {
		console.log('TOGGLES:')
		console.log('-t  print time:', printTime)
		console.log('-s  print stack:', printStack)
		console.log('-f  print forest:', printForest)
		console.log('-g  print graph:', printGraph)
		console.log('-p  parser path:', parserPath)
	} else {
		return false
	}

	return true
}