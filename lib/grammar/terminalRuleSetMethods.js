/**
 * Methods, which `grammar` inherits, that create `NSymbols` terminal rule sets.
 *
 * These methods which create an `NSymbol` are preferable to `NSymbol` instance methods that add the same terminal rule sets to an existing `NSymbol`. By not exposing the `NSymbol` (as easily), this abstraction seeks to prevent mixing these sets' rules with others on the same symbol.
 */

var util = require('../util/util')


/**
 * The inflections of a verb, from which `terminalRuleSetMethods.newVerbSet()` creates a terminal rule set where each rule of this set has as an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past`. When constructing parse trees, `pfsearch` conjugates this `text` object to the correct verb form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * The person-number forms, `oneSg`, `threeSg`, and `pl`, are conjugated by the `personNumber` property in preceding nominative rules.
 *
 * The tense form, `past`, is conjugated by the `grammaticalForm` property in the (immediate) parent nonterminal rule. Also, if the parent rule has `acceptedTense` set to `past`, it accepts the `past` form when input, but does not conjugate to it otherwise (unlike `grammaticalForm`).
 *
 * The grammar generator and `pfsearch` do not use `presentSubjunctive`, `presentParticiple`, and `pastParticiple` for conjugation. Rather, they serve only to enforce complete definitions of verbs for complete substitution sets, replaced when input by one of the forms in the set with conjugation support.
 *
 * Note: It is much better to have a single terminal rule set with dynamic grammatical conjugation than to define separate rule sets with different display text for each grammatical case (depending on the rule), with the same substitutions/synonyms. The overhead `Parser` endures for the larger state table (because of the additional rules) is far greater than the `pfsearch` overhead for the conjugation.
 *
 * @typedef {Object} VerbTermSet
 * @property {string} oneSg The first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
 * @property {string} threeSg The third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
 * @property {string} pl The plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
 * @property {string} [past] The past tense verb form, chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by `acceptedTense`. E.g., "was", "liked", "did".
 * @property {string} [presentSubjunctive] The present-subjunctive verb form, substituted when input with one of the first four forms. E.g., "be".
 * @property {string} [presentParticiple] The present-participle verb form, substituted when input with one of the first four forms. E.g., "being", "liking".
 * @property {string} [pastParticiple] The past-participle verb form, substituted when input with one of the first four forms. E.g., "been", "done".
 */
var verbTermSetSchema = {
	oneSg: { type: String, required: true },
	threeSg: { type: String, required: true },
	pl: { type: String, required: true },
	past: String,
	presentSubjunctive: String,
	presentParticiple: String,
	pastParticiple: String,
}

/**
 * Creates an `NSymbol` that produces terminal rule sets for a verb with the necessary text forms for conjugation.
 *
 * Each terminal rule in each set has as an object as its `text` with the properties `oneSg`, `threeSg`, `pl`, and `past` from the same set. When constructing parse trees, `pfsearch` conjugates the `text` object to the correct form (i.e., display text) according to grammatical properties in preceding nonterminal rules in the same tree.
 *
 * The method's parameter definition groups the terminal rules into sets for each verb, with each verb form defined for each set, to enable conjugation of incorrect inflections in input to the correct inflection of the same verb.
 *
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object.
 * @param {string} options.symbolName The name for the returned `NSymbol`.
 * @param {number} [options.insertionCost] The insertion cost for the terminal rule set, assigned to the first rule of the first verb set in `options.acceptedVerbTermSets`. Enables the creation of insertion rules using the `NSymbol` that produces these sets.
 * @param {VerbTermSet[]} options.acceptedVerbTermSets[] The verb terminal rule sets accepted when input.
 * @param {VerbTermSet[]} [options.substitutedVerbTermSets[]] The verb terminal rule sets substituted when input with the appropriate form in the first verb set in `options.acceptedVerbTermSets`. The parametrization of each form, as opposed to an array of terminal symbols, enforces complete definition of a verb set.
 * @returns {NSymbol} Returns the `NSymbol` for the terminal rule set.
 */
var verbSetSchema = {
	symbolName: { type: String, required: true },
	insertionCost: Number,
	acceptedVerbTermSets: { type: Array, arrayType: Object, required: true },
	substitutedVerbTermSets: { type: Array, arrayType: Object },
}

exports.newVerbSet = function (options) {
	if (util.illFormedOpts(verbSetSchema, options)) {
		throw new Error('Ill-formed verb set')
	}

	var verbSym = this.newSymbol(options.symbolName)
	// The terminal rule `text` object from the first verb set in `options.acceptedVerbTermSets`, used as the display text for all verb sets in `options.substitutedVerbTermSets`, if any.
	var defaultTextForms

	options.acceptedVerbTermSets.forEach(function (verbTermSet, i) {
		if (util.illFormedOpts(verbTermSetSchema, verbTermSet)) {
			throw new Error('Ill-formed verb')
		}

		// The terminal rule `text` object containing the verb inflections used in conjugation for each terminal symbol in `verbTermSet`.
		var verbSetTextForms = {
			oneSg: verbTermSet.oneSg,
			threeSg: verbTermSet.threeSg,
			pl: verbTermSet.pl,
			// Optional.
			past: verbTermSet.past,
		}

		// Track terminal symbols for this set to avoid errors for duplicate terminal rules. This is necessary to enable defining the verb form for every grammatical case even when some are identical. E.g., "like" is identical for first-person-singular and plural.
		var addedInlectionTermSyms = []

		// The terminal rule for the first-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "am", "was", "like".
		var oneSgTermRule = createVerbTerminalRule(verbTermSet.oneSg, verbSetTextForms, 'present')

		if (i === 0) {
			// Save the text forms for the first terminal rule set, which will substitute the terminal rules in `options.substitutedVerbTermSets`, if any, when input.
			defaultTextForms = verbSetTextForms

			// Assign the insertion cost, if any, to the first terminal rule in the first set.
			if (options.insertionCost !== undefined) {
				oneSgTermRule.insertionCost = options.insertionCost
			}
		}

		verbSym.addRule(oneSgTermRule)
		addedInlectionTermSyms.push(verbTermSet.oneSg)

		// If the terminal symbol is unique, add the terminal rule for the third-person-singular verb form, chosen by the nonterminal rule property `personNumber`. E.g., "is", "was", "likes".
		if (addedInlectionTermSyms.indexOf(verbTermSet.threeSg) === -1) {
			verbSym.addRule(createVerbTerminalRule(verbTermSet.threeSg, verbSetTextForms, 'present'))
			addedInlectionTermSyms.push(verbTermSet.threeSg)
		}

		// If the terminal symbol is unique, add the terminal rule for the the plural verb form, chosen by the nonterminal rule property `personNumber`. E.g., "are", "were" "like".
		if (addedInlectionTermSyms.indexOf(verbTermSet.pl) === -1) {
			verbSym.addRule(createVerbTerminalRule(verbTermSet.pl, verbSetTextForms, 'present'))
			addedInlectionTermSyms.push(verbTermSet.pl)
		}

		// If provided, add the terminal rule for the past tense verb form, chosen by the parent nonterminal rule property `grammaticalForm` and accepted when input by matching `acceptedTense`. E.g., "was", "liked", "did".
		if (verbTermSet.past) {
			if (addedInlectionTermSyms.indexOf(verbTermSet.past) !== -1) {
				util.logErrorAndPath('The past tense verb form is identical to a present tense form:', util.stylize(verbTermSet.past), verbTermSet)
				throw new Error('Ill-formed verb')
			}

			verbSym.addRule(createVerbTerminalRule(verbTermSet.past, verbSetTextForms, 'past'))
			addedInlectionTermSyms.push(verbTermSet.past)
		}

		// If provided, add the terminal rule for the present-subjunctive verb form, substituted when input with `verbSetTextForms`. E.g., "be".
		if (verbTermSet.presentSubjunctive && addedInlectionTermSyms.indexOf(verbTermSet.presentSubjunctive) === -1) {
			verbSym.addRule(createVerbTerminalRule(verbTermSet.presentSubjunctive, verbSetTextForms, 'present'))
			addedInlectionTermSyms.push(verbTermSet.presentSubjunctive)
		}

		// If provided, add the terminal rule for the present-participle verb form, substituted when input with `verbSetTextForms`. E.g., "being", "liking".
		if (verbTermSet.presentParticiple && addedInlectionTermSyms.indexOf(verbTermSet.presentParticiple) === -1) {
			verbSym.addRule(createVerbTerminalRule(verbTermSet.presentParticiple, verbSetTextForms, 'present'))
			addedInlectionTermSyms.push(verbTermSet.presentParticiple)
		}

		// If provided, add the terminal rule for the past-participle verb form, substituted when input with `verbSetTextForm` (and substituted with `past` if the parent rule has matching `acceptedTense`). E.g., "been", "done".
		if (verbTermSet.pastParticiple && addedInlectionTermSyms.indexOf(verbTermSet.pastParticiple) === -1) {
			verbSym.addRule(createVerbTerminalRule(verbTermSet.pastParticiple, verbSetTextForms, 'past'))
			addedInlectionTermSyms.push(verbTermSet.pastParticiple)
		}
	})

	// Add the terminal rule verb sets that are substituted when input with the appropriate verb form in first verb set in `options.acceptedVerbTermSets`.
	if (options.substitutedVerbTermSets) {
		options.substitutedVerbTermSets.forEach(function (verbTermSet) {
			if (util.illFormedOpts(verbTermSetSchema, verbTermSet)) {
				throw new Error('Ill-formed verb')
			}

			// Add all unique verb forms as terminal rules to be substituted when input with the first verb set in `options.acceptedVerbTermSets`.
			var addedInlectionTermSyms = []

			verbSym.addRule(createVerbTerminalRule(verbTermSet.oneSg, defaultTextForms, 'present'))
			addedInlectionTermSyms.push(verbTermSet.oneSg)

			if (addedInlectionTermSyms.indexOf(verbTermSet.threeSg) === -1) {
				verbSym.addRule(createVerbTerminalRule(verbTermSet.threeSg, defaultTextForms, 'present'))
				addedInlectionTermSyms.push(verbTermSet.threeSg)
			}

			if (addedInlectionTermSyms.indexOf(verbTermSet.pl) === -1) {
				verbSym.addRule(createVerbTerminalRule(verbTermSet.pl, defaultTextForms, 'present'))
				addedInlectionTermSyms.push(verbTermSet.pl)
			}

			if (verbTermSet.past) {
				if (addedInlectionTermSyms.indexOf(verbTermSet.past) !== -1) {
					util.logErrorAndPath('The past tense verb form is identical to a present tense form:', util.stylize(verbTermSet.past), verbTermSet)
					throw new Error('Ill-formed verb')
				}

				verbSym.addRule(createVerbTerminalRule(verbTermSet.past, defaultTextForms, 'past'))
				addedInlectionTermSyms.push(verbTermSet.past)
			}

			if (verbTermSet.presentSubjunctive && addedInlectionTermSyms.indexOf(verbTermSet.presentSubjunctive) === -1) {
				verbSym.addRule(createVerbTerminalRule(verbTermSet.presentSubjunctive, defaultTextForms, 'present'))
				addedInlectionTermSyms.push(verbTermSet.presentSubjunctive)
			}

			if (verbTermSet.presentParticiple && addedInlectionTermSyms.indexOf(verbTermSet.presentParticiple) === -1) {
				verbSym.addRule(createVerbTerminalRule(verbTermSet.presentParticiple, defaultTextForms, 'present'))
				addedInlectionTermSyms.push(verbTermSet.presentParticiple)
			}

			if (verbTermSet.pastParticiple && addedInlectionTermSyms.indexOf(verbTermSet.pastParticiple) === -1) {
				verbSym.addRule(createVerbTerminalRule(verbTermSet.pastParticiple, defaultTextForms, 'past'))
				addedInlectionTermSyms.push(verbTermSet.pastParticiple)
			}
		})
	}

	return verbSym
}

/**
 * Creates a terminal rule for `terminalSymbol` as part of a verb rule set to pass to `NSymbol.prototype.addRule()`.
 *
 * For use by `terminalRuleSetMethods.newVerbSet()`.
 *
 * @private
 * @static
 * @param {string} terminalSymbol The terminal symbol to match in input.
 * @param {Object} verbSetTextForms The terminal rule text object with all of a verb's forms for conjugation.
 * @param {string} tense The grammatical tense of `terminalSymbol`. Either 'present' or 'past'.
 * @returns {Object} Returns the new terminal rule, for which to pass to `NSymbol.prototype.addRule()`.
 */
function createVerbTerminalRule(terminalSymbol, verbSetTextForms, tense) {
	if (tense !== 'present' && tense !== 'past') {
		util.logError('Unrecognized verb rule tense:', util.stylize(tense))
		throw new Error('Ill-formed verb')
	}

	var newVerbRule = {
		isTerminal: true,
		rhs: terminalSymbol,
		text: verbSetTextForms,
	}

	if (tense === 'past') {
		/**
		 * Define `tense` for use by the parent nonterminal rule property `acceptedTense`, which uses the verb form of the same tense when a terminal rule with identical `tense` is matched in input. Does not conjugate to that tense if not input unless the parent rule property `grammaticalForm` dictates as such.
		 *
		 * If this rule is a past-participle form, is matched in input, and the parent rule's `acceptedTense` matches `tense`, `pfsearch` substitutes this symbol for the verb set's simple past form, `verbSetTextForms.past`.
		 *
		 * If the entire verb set is a substitution set, this property maintains input tense for rules with `acceptedTense`. For example:
		 *   "repos I work on" -> "repos I contribute to"
		 *   "repos I worked on" -> "repos I contributed to" (maintained optional input tense)
		 */
		newVerbRule.tense = tense
	}

	return newVerbRule
}

/**
 * Checks `options[paramName]` is a verb created by `terminalRuleSetMethods.newVerbSet()` that has inflected text for past tense. If not, prints an error message.
 *
 * @static
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object with the property to inspect.
 * @param {string} paramName The `options` property to inspect.
 * @returns {boolean} Returns `true` if `options[paramName]` is a verb with past tense, else `false`.
 */
exports.isVerb = function (options, paramName) {
	return baseIsVerb(options, paramName, true)
}

/**
 * Checks `options[paramName]` is a verb created by `terminalRuleSetMethods.newVerbSet()` that lacks inflected text for past tense. If not, prints an error message.
 *
 * @static
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object with the property to inspect.
 * @param {string} paramName The `options` property to inspect.
 * @returns {boolean} Returns `true` if `options[paramName]` is a verb without past tense, else `false`.
 */
exports.isPresentVerb = function (options, paramName) {
	return baseIsVerb(options, paramName, false)
}

/**
 * Checks `options[paramName]` is a verb created by `terminalRuleSetMethods.newVerbSet()` that has inflected text for past tense if `hasPastTense` is truthy or lacks past tense if `hasPastTense` is falsey. If not, prints an error message.
 *
 * @private
 * @static
 * @param {Object} options The options object with the property to inspect.
 * @param string} paramName The `options` property to inspect.
 * @param {boolean} hasPastTense Specify the verb should have or lack inflected text for past tense.
 * @returns {boolean} Returns `true` if `options[paramName]` is a verb with past tense if `hasPastTense` is truthy or without past tense if `hasPastTense` is falsey, else `false`.
 */
function baseIsVerb(options, paramName, hasPastTense) {
	// FIXME: Temporarily only inspect first terminal rule until successfully implementing `[like]` -> "star".
	var terminalRule = options[paramName].rules[0]
	var textForms = terminalRule.text

	// Check `options[paramName]` is a verb created by `terminalRuleSetMethods.newVerbSet()`.
	if (textForms.constructor !== Object || !textForms.oneSg || !textForms.threeSg || !textForms.pl) {
		printTerminalRuleSetErr(options, paramName, terminalRule, 'is not a verb created by `g.newVerbSet()`')
		return false
	}

	if (hasPastTense) {
		// Check `options[paramName]` has inflected text for past tense, even though optional for `terminalRuleSetMethods.newVerbSet()` (e.g., `[be]`).
		if (!textForms.past) {
			printTerminalRuleSetErr(options, paramName, terminalRule, 'lacks past tense inflection')
			return false
		}
	} else {
		// Check `options[paramName]` lacks inflected text for past tense.
		if (textForms.past) {
			printTerminalRuleSetErr(options, paramName, terminalRule, 'has past tense inflection')
			return false
		}
	}

	return true
}

/**
 * Checks `options[paramName]` is a terminal rule set that does not support conjugation (i.e., is invariable). If not, prints an error message.
 *
 * @static
 * @memberOf terminalRuleSetMethods
 * @param {Object} options The options object with the property to inspect.
 * @param {string} paramName The `options` property to inspect.
 * @returns {boolean} Returns `true` if `options[paramName]` is an invariable terminal rule set, else `false`.
 */
exports.isInvariableTerm = function (options, paramName) {
	var terminalRules = options[paramName].rules
	for (var r = 0, rulesLen = terminalRules.length; r < rulesLen; ++r) {
		var terminalRule = terminalRules[r]

		// Check `options[paramName]` lacks inflections.
		if (terminalRule.text.constructor !== String) {
			printTerminalRuleSetErr(options, paramName, terminalRule, 'has inflections')
			return false
		}
	}

	return true
}

/**
 * Prints an error for `options[paramName]`, an `NSymbol` that produces an incorrect terminal rule set.
 *
 * Formats the error as follows:
 *   Error: '${paramName}' ${description}: ${options[paramName].name} -> terminalRule.text
 *     ${options}
 *
 * @private
 * @static
 * @param {Object} options The options object with the property for which to print an error.
 * @param {string} paramName The `options` property for the `NSymbol` that produces the incorrect terminal rule set.
 * @param {Object} terminalRule The terminal rule at fault in `options[paramName].rules` to print.
 * @param {string} description The error description.
 */
function printTerminalRuleSetErr(options, paramName, terminalRule, description) {
	var errMsg = '\'' + paramName + '\' ' + description + ':'
	var termRuleSetSym = options[paramName]
	util.logError(errMsg, util.stylize(termRuleSetSym.name), '->', util.stylize(terminalRule.text))
	util.logPathAndObject(options)
}