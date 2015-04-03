var g = require('../grammar')
var util = require('../../util')
var relPronouns = require('./relativePronouns')
var auxVerbs = require('./auxVerbs')
var stopWords = require('./stopWords')
var operators = require('./operators')

// Start symbol
var start = new g.Symbol('start')

var intersectSemantic = new g.Semantic({ name: 'intersect', cost: 0 })

// Definition of accepted options for a Category
var categoryOptsSchema = {
	sg: String,
	pl: String,
	person: { type: Boolean, optional: true }, // "that" vs. "who" for relative pronoun
	entity: { type: Boolean, optional: true }
}

// Create the rules every must category
module.exports = function Category(catOpts) {
	if (util.illFormedOpts(categoryOptsSchema, catOpts)) {
		throw 'ill-formed Category'
	}

	this.nameSg = catOpts.sg
	this.namePl = catOpts.pl

	this.lhs = new g.Symbol(this.nameSg, 'lhs')
	this.lhs.addRule({ terminal: true, RHS: g.emptyTermSym })

	this.head = new g.Symbol(this.nameSg, 'head')

	if (!catOpts.person) {
		this.headMayPoss = new g.Symbol(this.nameSg, 'head', 'may', 'poss')

		// |Github repos (I starred)
		this.head.addRule({ RHS: [ this.headMayPoss ] })

		this.possessible = new g.Symbol(this.nameSg, 'possessible')
		// (my) repos
		this.possessible.addRule({ RHS: [ this.lhs, this.headMayPoss ] })
	}

	var lhsHead = new g.Symbol(this.nameSg, 'lhs', this.nameSg, 'head')
	// people (I follow); people (followed by me)
	lhsHead.addRule({ RHS: [ this.lhs, this.head ], transpositionCost: 1 })


	var passivePlus = new g.Symbol(this.nameSg, 'passive+')
	// (people) followed by me
	this.passive = new g.Symbol(this.nameSg, 'passive')
	passivePlus.addRule({ RHS: [ this.passive ] })
	// (repos) liked by me and created by {user}
	var andPassivePlus = new g.Symbol('and', this.nameSg, 'passive+')
	andPassivePlus.addRule({ RHS: [ operators.and, passivePlus ] })
	passivePlus.addRule({ RHS: [ this.passive, andPassivePlus ] })
	// (repos) liked by me or created by {user}
	var orPassivePlus = new g.Symbol('or', this.nameSg, 'passive+')
	orPassivePlus.addRule({ RHS: [ operators.union, passivePlus ] })
	passivePlus.addRule({ RHS: [ this.passive, orPassivePlus ] })


	var reducedNoTense = new g.Symbol(this.nameSg, 'reduced', 'no', 'tense')
	// (people) followed by me; (people who are) followed by me
	reducedNoTense.addRule({ RHS: [ passivePlus ]})

	var reduced = new g.Symbol(this.nameSg, 'reduced')
	// (people) followed by me
	reduced.addRule({ RHS: [ reducedNoTense ]})


	// (people who) follow me
	this.subjFilter = new g.Symbol(this.nameSg, 'subj', 'filter')


	var objFilterPlus = new g.Symbol(this.nameSg, 'obj', 'filter+')
	// (people) I follow
	this.objFilter = new g.Symbol(this.nameSg, 'obj', 'filter')
	objFilterPlus.addRule({ RHS: [ this.objFilter ] })
	// (people) I follow and {user} follows
	var andObjFilterPlus = new g.Symbol('and', this.nameSg, 'obj', 'filter+')
	andObjFilterPlus.addRule({ RHS: [ operators.and, objFilterPlus ] })
	objFilterPlus.addRule({ RHS: [ this.objFilter, andObjFilterPlus ] })
	// (people) I follow or {user} follows
	var orObjFilterPlus = new g.Symbol('or', this.nameSg, 'obj', 'filter+')
	orObjFilterPlus.addRule({ RHS: [ operators.union, objFilterPlus ] })
	objFilterPlus.addRule({ RHS: [ this.objFilter, orObjFilterPlus ] })


	var rhsExt = new g.Symbol(this.nameSg, 'rhs', 'ext')
	// (people) I follow
	rhsExt.addRule({ RHS: [ objFilterPlus ] })


	var rhs = new g.Symbol(this.nameSg, 'rhs')
	rhs.addRule({ terminal: true, RHS: g.emptyTermSym })
	// (people) followed by me
	rhs.addRule({ RHS: [ reduced ] })
	// (people) I follow
	rhs.addRule({ RHS: [ rhsExt ] })
	// (people) I follow <adverbial-stopword>
	rhs.addRule({ RHS: [ rhs, stopWords.sentenceAdverbial ] })


	var noRelativeBase = new g.Symbol(this.nameSg, 'no', 'relative', 'base')
	// people I follow; people followed by me
	noRelativeBase.addRule({ RHS: [ lhsHead, rhs ], transpositionCost: 1 })

	var noRelative = new g.Symbol(this.nameSg, 'no', 'relative')
	// people followed by me; people I follow
	noRelative.addRule({ RHS: [ noRelativeBase ] })
	// my followers
	this.noRelativePossessive = new g.Symbol(this.nameSg, 'no', 'relative', 'possessive')
	noRelative.addRule({ RHS: [ this.noRelativePossessive, rhs ], transpositionCost: 1 })


	var filter = new g.Symbol(this.nameSg, 'filter')
	// (people who) follow me
	filter.addRule({ RHS: [ this.subjFilter ]})
	// (people who) I follow
	filter.addRule({ RHS: [ this.objFilter ]})
	// (people who) I follow <adverbial-stopword>
	filter.addRule({ RHS: [ filter, stopWords.sentenceAdverbial ]})
	// (people who) are followers of mine
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, noRelative ]})
	// (people who) are followed by me
	filter.addRule({ RHS: [ auxVerbs.beNon1Sg, reducedNoTense ]})


	var bePastReducedNoTense = new g.Symbol('be', 'past', this.nameSg, 'reduced', 'no', 'tense')
	// (people who have) been followed by me; (people who have) been following me
	bePastReducedNoTense.addRule({ RHS: [ auxVerbs.bePast, reducedNoTense ] })
	// (people who) have been folllowed by me; (people who) have been following me
	// - personNumber exists to force [have] -> "have"
	filter.addRule({ RHS: [ auxVerbs.have, bePastReducedNoTense ], personNumber: 'pl' })


	// (people who) follow me
	var filterPlus = new g.Symbol(this.nameSg, 'filter+')
	filterPlus.addRule({ RHS: [ filter ] })
	// (people) who ... and I follow
	var andFilterPlus = new g.Symbol('and', this.nameSg, 'filter+')
	andFilterPlus.addRule({ RHS: [ operators.and, filterPlus ]})
	filterPlus.addRule({ RHS: [ filter, andFilterPlus ] })
	// (people) who ... and who I follow
	var relPronounFilterPlus = new g.Symbol(catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	relPronounFilterPlus.addRule({ RHS: [ catOpts.person ? relPronouns.who : relPronouns.that, filterPlus ] })
	var andRelPronounFilterPlus = new g.Symbol('and', catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	andRelPronounFilterPlus.addRule({ RHS: [ operators.and, relPronounFilterPlus ] })
	filterPlus.addRule({ RHS: [ filter, andRelPronounFilterPlus ] })
	// (people) who ... or I follow
	var orFilterPlus = new g.Symbol('or', this.nameSg, 'filter+')
	orFilterPlus.addRule({ RHS: [ operators.union, filterPlus ]})
	filterPlus.addRule({ RHS: [ filter, orFilterPlus ] })
	// (people) who ... or who I follow
	var orRelPronounFilterPlus = new g.Symbol('or', catOpts.person ? 'who' : 'that', this.nameSg, 'filter+')
	orRelPronounFilterPlus.addRule({ RHS: [ operators.union, relPronounFilterPlus ] })
	filterPlus.addRule({ RHS: [ filter, orRelPronounFilterPlus ] })


	var relativeclause = new g.Symbol(this.nameSg, 'relativeclause')
	if (catOpts.person) {
		// (people) who are followed by me
		relativeclause.addRule({ RHS: [ relPronouns.who, filterPlus ]})
	} else {
		// (repos) that are liked by me
		relativeclause.addRule({ RHS: [ relPronouns.that, filterPlus ]})
	}


	this.plural = new g.Symbol(this.nameSg, 'plural')
	// people followed by me
	this.plural.addRule({ RHS: [ noRelative ], semantic: intersectSemantic })
	// people who are followed by me
	this.plural.addRule({ RHS: [ noRelative, relativeclause ], semantic: intersectSemantic })

	this.catPl = new g.Symbol(this.namePl)
	// (people who created) repos ...
	this.catPl.addRule({ RHS: [ this.plural ] })

	if (catOpts.entity) {
		this.catSg = new g.Symbol(this.nameSg)
		// (people) {user} (follows); (people who follow) {user}
		this.catSg.addRule({ terminal: true, RHS: '{' + this.nameSg + '}' })

		if (!catOpts.person) { // user does not use because obj/nom-users -> [user]
			// (people who like) {repo}
			this.catPl.addRule({ RHS: [ this.catSg ] })
		}
	}

	if (!catOpts.person) { // user does not use because obj/nom-users
		// (people who like) repos ...
		this.catPlPlus = new g.Symbol(this.namePl + '+')
		this.catPlPlus.addRule({ RHS: [ this.catPl ] })
		// (people who like) my repos and {user}'s repos
		var andCatPlPlus = new g.Symbol('and', this.namePl + '+')
		andCatPlPlus.addRule({ RHS: [ operators.and, this.catPlPlus ] })
		this.catPlPlus.addRule({ RHS: [ this.catPl, andCatPlPlus ] })
		// (people who like) my repos or {user}'s repos
		var orCatPlPlus = new g.Symbol('or', this.namePl + '+')
		orCatPlPlus.addRule({ RHS: [ operators.union, this.catPlPlus ] })
		this.catPlPlus.addRule({ RHS: [ this.catPl, orCatPlPlus ] })
	}

	start.addRule({ RHS: [ this.catPl ]})
}