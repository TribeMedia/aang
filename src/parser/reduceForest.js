// Might be able to be accomplished in search.js, but here we are proving accuracy and performance improvements

var semantic = require('../grammar/Semantic')
var util = require('../util')

module.exports = function (startNode) {
	for (var s = 0, subs = startNode.subs, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		sub.minCost = 0 // initialize to 0 to add for sub and sub.next
		clean(sub, sub.node.subs)
	}
}

function clean(parentSub, subs) {
	var minCost

	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		// Do not inspect same sub more than once (subs can be in more than one node)
		if (sub.minCost === undefined) {
			sub.minCost = 0 // initialize to 0 to add for sub and sub.next

			var childSubs = sub.node.subs
			if (childSubs) {
				clean(sub, childSubs)

				// Only nonterminal rules are binary (hence, within childSubs check)
				var subNext = sub.next
				if (subNext) {
					// sub.next will never be terminal (because all binary rules are nonterminal)
					clean(sub, subNext.node.subs)
				}
			}
		}

		// Get cost after calling clean() on children because of reductions
		var subRuleProps = sub.ruleProps
		var cost = sub.minCost + (subRuleProps.constructor === Array ? subRuleProps[0].cost : subRuleProps.cost)

		if (minCost === undefined || cost < minCost) {
			minCost = cost
		}
	}

	// Add for cost of sub and sub.next
	parentSub.minCost += minCost


	// We are handling the same parentSub more than once, but unsure how
	// Could be there are duplicates because of different 'position' in query (diff nodeTab)
	if (subsLen === 1) {
		if (parentSub.next || sub.next) return

		var parentRuleProps = parentSub.ruleProps
		var ruleProps = sub.ruleProps

		if (parentRuleProps.constructor === Array || ruleProps.constructor	=== Array) return
		if (parentRuleProps.insertedSemantic || ruleProps.insertedSemantic) return
		if (parentRuleProps.semantic && ruleProps.semantic) return
		if (parentRuleProps.personNumber) return
		if (parentRuleProps.verbForm || ruleProps.verbForm) return

		if (ruleProps.insertionIdx === 0 && parentRuleProps.insertionIdx === 0) return
		if (parentRuleProps.insertionIdx === 1 || ruleProps.insertionIdx === 1) return

		parentSub.node = sub.node
		var newRuleProps = parentSub.ruleProps = {
			cost: parentRuleProps.cost + ruleProps.cost,
			semantic: parentRuleProps.semantic || ruleProps.semantic
		}

		parentSub.minCost -= ruleProps.cost // subtract the ruleProps.cost, which now belongs to parent

		if (ruleProps.personNumber) {
			newRuleProps.personNumber = ruleProps.personNumber
		}

		var subText = ruleProps.text
		var parentText = parentRuleProps.text
		if (parentRuleProps.insertionIdx === 0) {
			if (subText) {
				newRuleProps.text = parentText.concat(subText)
			} else {
				newRuleProps.text = parentText
			}
		} else if (ruleProps.insertionIdx === 0) {
			if (parentText) {
				newRuleProps.text = subText.concat(parentText)
			} else {
				newRuleProps.text = subText
			}
		} else {
			var parentGramCase = parentRuleProps.gramCase
			if (parentGramCase && subText[parentGramCase]) {
				newRuleProps.text = subText[parentGramCase]
			} else {
				if (ruleProps.gramCase) newRuleProps.gramCase = ruleProps.gramCase
				newRuleProps.text = parentText || subText
			}
		}
	}
}