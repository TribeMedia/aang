var g = require('./src/grammar')

require('./src/grammar/user')

var grammarPath = './grammar.json'
g.createEditRules()
g.printRuleCount(grammarPath)
g.writeGrammarToFile(grammarPath)


/*
TODO:

Do the absolute minimum, then build up
- Any additional complexity will rely on same foundation - foolish to try to capture multiple things at once
- No display text correction, no edit rules
*/