var g = require('../../grammar')
var user = require('./user')
var auxVerbs = require('../auxVerbs')


// Returns objects associated with a date in the past (excluding the present).
var pastSemantic = g.newSemantic({
	name: 'past',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past or present.
var everPastSemantic = g.newSemantic({
	name: g.hyphenate('ever', 'past'),
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

// Returns objects associated with a date in the past, present, or future.
// NOTE: Might remove this semantic.
var everSemantic = g.newSemantic({
	name: 'ever',
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

var notEverSemantic = g.reduceSemantic(auxVerbs.notSemantic, everSemantic)


var previously = g.newSymbol('previously').addWord({
	accepted: [ 'previously', 'formerly' ],
})

var ever = g.newSymbol('ever').addWord({
	accepted: [ 'ever' ],
})

var never = g.newSymbol('never').addWord({
	accepted: [ 'never' ],
	substitutions: [ 'not ever' ],
})

var haveEverOpt = g.newSymbol(auxVerbs.have.name, ever.name, 'opt').addRule({
	rhs: [ auxVerbs.have, ever ],
}).addRule({
	rhs: [ auxVerbs.have ],
})


// Represents past actions for verbs for which the tense (i.e., time) is meaningful.
user.subjFilterPast = g.newSymbol(user.subjFilter.name, 'past')
user.subjFilterPresent = g.newSymbol(user.subjFilter.name, 'present')


// (people who) worked at `[companies+]`, `ever-past()`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast ],
	semantic: everPastSemantic,
})

// (people who) previously worked at `[companies+]`, `past()`
user.subjFilter.addRule({
	rhs: [ previously, user.subjFilterPast ],
	// Enable transposition:
	//   "(people who) worked at `[companies+]` previously" -> "(people who) previously worked at `[companies+]`"
	transpositionCost: 1,
	// Prevent `[previously]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference is not obvious.
	noInsertionIndexes: [ 0 ],
	semantic: pastSemantic,
})

/**
 * NOTE: Currently, all suggestions after the first result exclude "in the past" because "in the past" is also a stop-word (`[sentence-adverbial]`). This is because no insertions are possible for when "in the past" is not matched to the stop-word. Fixing this requires insertions for "and `[filter+]`" (and similar rules), which can not be implemented until preventing cases where `pfsearch` finds no legal parse trees due to semantic restrictions (otherwise, it can search infinitely).
 *
 * NOTE: Perhaps do not include this rule because it is confusing what "in the past" applies to. For example
 *   "(people who) worked at companies that raised 20 in funding in the past"
 */
// FIXME: Improve and finalize multi-token terminal symbol implementation.
var inThePast = g.newSymbol('in', 'the', 'past').addRule({ isTerminal: true, rhs: 'in the past'})
// (people who) worked at `[companies+]` in the past, `past()`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast, inThePast ],
	// Prevent `[in-the-past]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference is not obvious.
	noInsertionIndexes: [ 1 ],
	semantic: pastSemantic,
})

// (people who) ever worked at `[companies+]`, `ever()`
user.subjFilter.addRule({
	rhs: [ ever, user.subjFilterPast ],
	// Prevent `[ever]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: everSemantic,
})

// (people who) have |ever worked at `[companies+]`, `ever()`
user.subjFilter.addRule({
	// NOTE: Unsure whether to use `[have-ever-opt]`, or flatten and create one more `[user-subj-filter]` rule.
	rhs: [ haveEverOpt, user.subjFilterPast ],
	// Prevent `[have]` insertion. Though semantically distinct from `[user-subj-filter]` -> `[user-subj-filter-past]`, the difference is not obvious.
	noInsertionIndexes: [ 0 ],
	semantic: everSemantic,
})

// (people who) have not worked at `[companies+]`, `not(ever())`
user.subjFilter.addRule({
	rhs: [ auxVerbs.haveNoInsertNegation, user.subjFilterPast ],
	// Prevent `[have-no-insert-negation]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: notEverSemantic,
})

// (people who) never worked at `[companies+]`, `not(ever())`
user.subjFilter.addRule({
	rhs: [ never, user.subjFilterPast ],
	// Prevent `[never]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: notEverSemantic,
})

// (people who) have never worked at `[companies+]`, `not(ever())`
user.subjFilter.addRule({
	rhs: [ [ auxVerbs.have, never ], user.subjFilterPast ],
	// Prevent `[have-never]` insertion.
	noInsertionIndexes: [ 0 ],
	semantic: notEverSemantic,
})

// (people who) did not work at `[companies+]`, `not(ever())`
// Allow `[do-past-negation]` insertion for the following:
//   "people who not ..." -> "people who did not ..."
user.subjFilter.addRule({
	rhs: [ auxVerbs.doPastNegation, user.subjFilterPresent ],
	semantic: notEverSemantic,
})