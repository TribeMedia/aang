var util = require('../util')


 /**
  * Finds and prints instances of ambiguity in the context-free grammar.
  *
  * Ambiguity exists when there are multiple paths from a single nonterminal symbol to the same rightmost symbols. When ambiguity is found, parse trees demonstrating the ambiguity are printed to demonstrate the necessary changes to make to the grammar.
  *
  * Called after `createEditRules.js`, which creates edit-rules and rules generated by the `<empty>` symbol.
  *
  * This module was a massive undertaking. All cases of possible ambiguity are documented in detail in 'ambiguityExamples.js'. Many algorithms were created and ensured to catch all possible ambiguous cases. Several algorithms and unique data structures were developed and heuristics developed to make the construction of all possible paths and the comparison of paths as fast as possible. Many trials and errors. It was over 100 hours of work.
  *
  * @param {Object} grammar The grammar to inspect.
  * @param {Object} opts Options object.
  */

var optsSchema = {
	// Maximum number of symbols permitted in the construction of a path when searching for ambiguity.This bound is necessary, as the grammar permits paths of infinite length and combination. `14` is a reasonable number and will require 3 seconds to process.
	symsLimit: Number,
	// If `false` (the default), prints only one instance of ambiguity produced by a pair of rules.
	// If `true`, prints every distinct pair of ambiguous trees found.
	// Often, the former (and default) is sufficient for determining the necessary changes to make to the grammar; though, the latter can be helpful as the change needed might be in a subsequent rule produced by the rule at the root of an instance of ambiguity. For certain cases when `findAll` is `true`, such as recursive rules (i.e., a rule whose RHS contains the LHS), an excessive number of ambiguity instances will be printed.
	findAll: { type: Boolean, optional: true },
	// Replace `grammar` with ambiguous test rules, defined and explained in 'ambiguityExamples.js', to check the accuracy of this algorithm.
	useTestRules: { type: Boolean, optional: true },
	// Do not print output. Used when benchmarking this algorithm.
	noOutput: { type: Boolean, optional: true },
}

module.exports = function (grammar, opts) {
	if (util.illFormedOpts(optsSchema, opts)) {
		return
	}

	// If `opts.useTestRules` is `true`, replace `grammar` with ambiguous test rules to check the accuracy of this algorithm.
	if (opts.useTestRules) {
		// Delete existing rules
		for (var sym in grammar) {
			delete grammar[sym]
		}

		// Build grammar of ambiguous test rules
		require('./ambiguityExamples')
	}

	if (!opts.noOutput) console.time('Ambiguity check')

	// Construct all possible paths from `nontermSym`.
	for (var nontermSym in grammar) {
		searchPaths(nontermSym)
	}

	if (!opts.noOutput) console.timeEnd('Ambiguity check')

	/**
	 * Check for ambiguity created by a nonterminal symbol's rules. Compares paths created by each rules from the symbol to paths created by the other rules. Does not compare paths produced by the same inital rule, because if ambiguity exists there, then it is caused by another symbol.
	 *
	 * Initializes the paths from the nonterminal symbol, but calls `buildPaths()` to recursively expand the paths.
	 *
	 * @param {String} nontermSym The nonterminal symbol from which to search for ambiguity.
	 */
	function searchPaths(nontermSym) {
		// The store of all paths from `nontermSym`. Each index contains a set of arrays of paths, one set for each rule from `nontermSym`. Each set is a map of terminal strings to the arrays of paths.
		var pathTab = []
		// The rules `nontermSym` produces.
		var rules = grammar[nontermSym]

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Do not inspect edit rules:
			// - Insertions can create ambiguity (i.e., same output produced with different insertions). But needed because it depends input (i.e., possible insertions always different).
			// - Ambiguity from transpositions is prevented at rule creation (i.e., prevents what would be duplicate)
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var newPath = {
					// The next symbol from which to expand this path.
					nextSym: undefined,
					// Linked list of second branches of binary rules
					nextSyms: undefined,
					// String of terminal symbols in this path.
					terminals: '',
					// Number of symbols used by this path, to ensure below `opts.symsLimit` bound.
					symsCount: 1 + RHSLen,
					// The RHS symbols of the rule used to construct this path.
					// Used to create a linked list of rules used in each path to generate a parse tree when finding (and printing) an instance of ambiguity.
					RHS: RHS,
				}

				if (rule.terminal) {
					// Prefix space because all will begin with space
					newPath.terminals += ' ' + RHS[0]
				} else {
					if (RHSLen === 2) {
						// Return to second symbol in binary rule after completing this branch
						newPath.nextSyms = { sym: RHS[1] }
					}

					newPath.nextSym = RHS[0]
				}

				// Paths produced by each rule of `nontermSym` is stored in a separate set of paths. That set maps strings of terminal symbols to arrays of paths.
				var pathSets = {}

				// Create an array of paths with this string of terminal symbols.
				pathSets[newPath.terminals] = [ newPath ]
				pathTab.push(pathSets)
			}
		}

		// only one rule possible from this LHS, so no ambiguity will appear ONLY here
		// check pathTab, not initpaths, in case comparing a sym with terminal and nonterminal rules
		var pathTabLen = pathTab.length

		// Exit if there is only one (non-edit) rule produced by `nontermSym` because at least two rules are required for ambiguity to exist.
		if (pathTabLen === 1) return

		// Expand all paths created by `nontermSym`'s rules.
		for (var p = 0; p < pathTabLen; ++p) {
			var pathSets = pathTab[p]

			// There is one paths for each `pathTab` index.
			for (var term in pathSets) {
				var path = pathSets[term][0]

				if (path.nextSym) {
					buildPaths(pathSets, path)
				}
			}
		}

		// Search for ambiguity after constructing all paths.
		findAmbiguity(pathTab)
	}

	/**
	 * Construct all possible expansions of a path by its rightmost nonterminal symbol. Add the new paths to the `pathTab` to search for ambiguity.
	 *
	 * @param {[type]} pathSets The set of paths for a single root rule that produced `lastPath`.
	 * @param {[type]} lastPath The path to expand.
	 */
	function buildPaths(pathSets, lastPath) {
		// The subsequent paths that can be made to expand `lastPath`.
		var rules = grammar[lastPath.nextSym]
		var lastNextSyms = lastPath.nextSyms

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			// Do not inspect edit rules:
			// - Insertions can create ambiguity (i.e., same output produced with different insertions). But needed because it depends input (i.e., possible insertions always different).
			// - Ambiguity from transpositions is prevented at rule creation (i.e., prevents what would be duplicate)
			if (rule.insertionIdx === undefined && !rule.transposition) {
				var RHS = rule.RHS
				var RHSLen = RHS.length

				var newPath = {
					// The next symbol from which to expand this path.
					nextSym: undefined,
					// Linked list of second branches of binary rules.
					nextSyms: lastNextSyms,
					// String of terminal symbols in this path.
					terminals: lastPath.terminals,
					// Number of symbols used by this path, to ensure below `opts.symsLimit` bound.
					symsCount: lastPath.symsCount + RHSLen,
					// Linked list for tree generation
					RHS: RHS,
					prev: lastPath,
				}

				if (rule.terminal) {
					// Append terminal symbol.
					newPath.terminals += ' ' + RHS[0]

					// After reaching the end of a branch, go the second symbol of the most recent binary rule.
					if (lastNextSyms) {
						newPath.nextSym = lastNextSyms.sym
						newPath.nextSyms = lastNextSyms.next
					}
				} else {
					if (RHSLen === 2) {
						// If rule is binary, add the second RHS symbol to the list of `nextSyms`. The rule will resume after completing the branch produced by the first RHS symbol.
						// A linked list is faster than an array, which would require cloning the array before modiying it to avoid mutuating the resource shared amongst paths.
						newPath.nextSyms = { sym: RHS[1], next: lastNextSyms }
					}

					// Next nonterminal symbol to expand.
					newPath.nextSym = RHS[0]
				}

				// Add new path to set of paths from this root rule with these terminal symbols.
				var paths = pathSets[newPath.terminals]
				if (paths) {
					paths.push(newPath)
				} else {
					pathSets[newPath.terminals] = [ newPath ]
				}

				// If the path has not reached all terminal symbols (i.e., has a `nextSym`), and is below `symsLimit` (otherwise will build infinite paths), then continue to expand path.
				if (newPath.nextSym && newPath.symsCount < opts.symsLimit) {
					buildPaths(pathSets, newPath)
				}
			}
		}
	}

	/**
	 * Finds and prints ambiguity created by paths produced by `nontermSym`. Ambiguity exists if multiple paths exist to the same rightmost symbols. If ambiguity is found among a pair of paths, prints the parse trees for those paths.
	 *
	 * Compares paths produced by different root rules, where `nontermSym` is the root symbol. Does not compare paths from the same root rule, because any ambiguity that exists there is caused by a symbol other than this root symbol.
	 *
	 * By default, print only one instance of ambiguity found between a pair of root rules. If `opts.findAll` is `true`, print every distinct pair of ambiguous trees found. Often, the former (and default) is sufficient for determining the necessary changes to the grammar, though the latter can be helpful as the change required might not the root rule, but rather a sub rule only demonstrated when used with this root rule. For certain cases, such as recursive rules (i.e., a rule whose RHS contains the LHS), `findAll` will print too much.
	 *
	 * Function is called after construction all possible paths produced by `nontermSym`.
	 *
	 * @param {Object} pathTab The set of paths produced by `nontermSym`.
	 */
	function findAmbiguity(pathTab) {
		var foundAmbiguity = false

		// If `opts.findAll` is `true`, track distinct pairs of ambiguous trees to prevent printing the same instance of ambiguity multiple times when found in multiple pairs of trees.
		if (opts.findAll) {
			var ambigPairs = []
		}

		// Check for ambiguity among pairs of paths created by different root rules.
		for (var a = 0, pathTabLen = pathTab.length; a < pathTabLen; ++a) {
			var pathSetsA = pathTab[a]

			for (var b = a + 1; b < pathTabLen; ++b) {
				var pathSetsB = pathTab[b]

				// Check each set of paths produced from this root rule (i.e., index `a` of `pathTab`) organized by their terminal symbols.
				for (var terminals in pathSetsA) {
					var pathsB = pathSetsB[terminals]

					// Check if paths exist from this root rule (i.e., index `b` of `pathTab`) with these terminal symbols.
					if (!pathsB) continue

					var pathsBLen = pathsB.length
					var pathsA = pathSetsA[terminals]

					// Sort paths by decreasing size to print the smallest (and simplest) pair of ambiguous trees for this pair of root rules. (When `opts.findAll` is `false` and ambiguity exists, only a single (i.e., the first found) pair of ambiguous trees is printed for each pair of root rules.)
					pathsA.sort(function (a, b) {
						return a.symsCount - b.symsCount
					})

					// Compare paths among this pair of root rules which have identical terminal rules.
					for (var p = 0, pathsALen = pathsA.length; p < pathsALen; ++p) {
						var pathA = pathsA[p]
						var nextSym = pathA.nextSym
						var nextSyms = pathA.nextSyms

						for (var o = 0; o < pathsBLen; ++o) {
							var pathB = pathsB[o]

							// A pair of paths is ambiguous when `terminals`, `nextSym`, and `nextSyms` are identical.
							if (pathB.nextSym === nextSym && listsEqual(pathB.nextSyms, nextSyms)) {
								foundAmbiguity = true

								// Do not print if benchmarking this algorithm's performance.
								if (opts.noOutput) break

								// Convert a reverse linked list of paths containing the RHS symbols of every rule used in construction to an array, which is converted to a parse tree.
								var treeA = rulesToTree(nontermSym, listToArray(pathA))
								var treeB = rulesToTree(nontermSym, listToArray(pathB))

								// Remove the rightmost portions of the pair of trees that the pair have in common. This trims the trees up to the portions created by the rules causing the ambiguity.
								diffTrees(treeA, treeB)

								// Print instance of ambiguity if either are true:
								// 1) `opts.findAll` is `false`. Then, this is the first (and last) instance of ambiguity found to have been created by this pair of root rules.
								// 2) `opts.findAll` is `true` and this instance of ambiguity has not been seen. Confirmed by checking if this pair, after being processed by `diffTrees()`, already exists in previously seen pairs in `ambigPairs`. The same instance of ambiguity can be found in multiple pairs of trees when the pairs are distinguished by rules that come after the rules creating ambiguity.
								if (!opts.findAll || !pairExists(ambigPairs, treeA, treeB)) {
									util.printWarning('Ambiguity')
									util.log(treeA, treeB)

									if (opts.findAll) {
										// Save this distinct pair of ambiguous trees to prevent printing it multiple times.
										ambigPairs.push([ treeA, treeB ])
									} else {
										// Only print one instance of ambiguity for this pair of root rules.
										break
									}
								}
							}
						}

						if (o < pathsBLen) break
					}

					if (p < pathsALen) break
				}
			}
		}

		// If `opts.useTestRules` is `true`, use ambiguous test rules to check the accuracy of this algorithm, print an error message if a symbol's ambiguity is not found.
		if (!foundAmbiguity && opts.useTestRules && nontermSym.indexOf('ambig') === 1) {
			util.printErr('Ambiguity not found in test rule', nontermSym)
		}
	}
}

/**
 * Checks if a pair of ambiguous trees exists in `ambigPairs`. Called when `opts.findAll` is `true`, after the trees have been processed by `diffTrees()`, to prevent printing the same instance of ambiguity multiple times when found in multiple pairs of trees.
 *
 * @param {Array} ambigPairs The array of distinct pairs of ambiguous trees found so far.
 * @param {Object} treeA The first of the new pair of ambiguous trees.
 * @param {Object} treeB The second of the new pair of ambiguous trees.
 * @return {Boolean} `true` if the pairs exists in `ambigPairs`, else `false`.
 */
function pairExists(ambigPairs, treeA, treeB) {
	for (var a = 0, ambigPairsLen = ambigPairs.length; a < ambigPairsLen; ++a) {
		var ambigPair = ambigPairs[a]
		var otherTreeA = ambigPair[0]
		var otherTreeB = ambigPair[1]

		if (nodesEqual(otherTreeA, treeA) && nodesEqual(otherTreeB, treeB)) {
			return true
		}

		if (nodesEqual(otherTreeA, treeB) && nodesEqual(otherTreeB, treeA)) {
			return true
		}
	}

	return false
}

/**
 * Converts a path in the form of an array of RHS symbols to a parse tree.
 *
 * @param {String} lhsSym The LHS symbol of the path's root rule.
 * @param {Array} rules The array of arrays of RHS symbols to convert to a parse tree.
 * @return {Object} The converted parse tree.
 */
function rulesToTree(lhsSym, rules) {
	// Nonterminal symbol
	if (lhsSym[0] === '[') {
		var ruleRHS = rules.shift()
		if (ruleRHS) {
			var newNodeChildren = []
			for (var r = 0, rhsLen = ruleRHS.length; r < rhsLen; ++r) {
				newNodeChildren.push(rulesToTree(ruleRHS[r], rules))
			}

			return {
				symbol: lhsSym,
				children: newNodeChildren
			}
		}
	}

	// Terminal symbol or last nonterminal symbol in path
	return {
		symbol: lhsSym
	}
}

/**
 * Converts a reverse linked list (i.e., elements only contain pointers to the previous element) of a path (holding the RHS symbols) to an array.
 *
 * @param {Object} list The reverse linked list to convert.
 * @return {Array} The converted array.
 */
function listToArray(list) {
	var array = []

	while (list) {
		array.unshift(list.RHS)
		list = list.prev
	}

	return array
}

/**
 * Compares two linked lists of symbols to determine if they are equivalent.
 *
 * @param {Object} a The list to compare.
 * @param {Object} b The other list to compare.
 * @return {Boolean} `true` if the lists are equivalent, else `false`.
 */
function listsEqual(a, b) {
	if (!a && !b) return true

	if (!a || !b) return false

	if (a.sym !== b.sym) return false

	return listsEqual(a.next, b.next)
}

/**
 * Removes the rightmost portions of a pair of trees that the pair have in common. This trims the trees up to the portions created by the rules causing the ambiguity.
 *
 * When `opts.findAll` is `true`, `diffTrees()` prevents printing the same instance of ambiguity multiple times when found in multiple pairs of trees. I.e., the pairs are distinguished by rules that come after the rules creating ambiguity.
 *
 * @param {Object} a The tree to compare.
 * @param {Object} b The other tree to compare.
 */
function diffTrees(a, b) {
	// Invert trees to an array of rightmost symbols that lead back to the root node.
	var invertedTreeA = invertTree(a)
	var invertedTreeB = invertTree(b)

	// If there is a different number of rightmost symbols (i.e., branches), use the minimum length to compare as much of the trees as possible.
	// EX: X -> A -> "a"   X -> "a b"
	//       -> B -> "b"
	var minTreeWidth = Math.min(invertedTreeA.length, invertedTreeB.length)
	for (var n = 0; n < minTreeWidth; ++n) {
		var nodeObjA = invertedTreeA[n]
		var nodeObjB = invertedTreeB[n]

		// Trees have a different number of branches; break when at end of narrower tree.
		if (!nodeObjA || !nodeObjB) break

		// Traverse up the branches until the two differentiate.
		while (nodesEqual(nodeObjA.par.node, nodeObjB.par.node)) {
			nodeObjA = nodeObjA.par
			nodeObjB = nodeObjB.par
		}

		// Remove the identical portion from each branch.
		delete nodeObjA.node.children
		delete nodeObjB.node.children
	}
}

/**
 * Inverts a parse tree produced by `rulesToTree()` to an array of rightmost nodes with pointers to their parent nodes, ending at the tree's root node.
 *
 * @param {Object} tree The root node of the parse tree.
 * @return {Array} The inverted tree as an array of rightmost nodes with pointers to parents.
 */
function invertTree(tree) {
	var stack = [ { node: tree } ]
	var rightmostSyms = []

	while (stack.length) {
		var nodeObj = stack.pop()

		var childNodes = nodeObj.node.children
		if (childNodes) {
			// Iterate backward to traverse left branch first.
			for (var c = childNodes.length; c-- > 0;) {
				stack.push({ node: childNodes[c], par: nodeObj })
			}
		} else {
			rightmostSyms.push(nodeObj)
		}
	}

	return rightmostSyms
}

/**
 * Determines whether two nodes are equivalent. Nodes are equivalent if they have the same symbol and identical children (determined recursively).
 *
 * @param {Object} a The node to compare.
 * @param {Object} b The other node to compare.
 * @return {Boolean} `true` if the nodes are equivalent, else `false`.
 */
function nodesEqual(a, b) {
	if (a.symbol !== b.symbol) return false

	var aChildren = a.children
	var bChildren = b.children

	// Identical symbols and both lack children.
	if (!aChildren && !bChildren) return true

	if (aChildren && bChildren) {
		var aChildrenLen = aChildren.length
		if (aChildrenLen === bChildren.length) {
			for (var n = 0; n < aChildrenLen; n++) {
				if (!nodesEqual(aChildren[n], bChildren[n])) return false
			}

			// Identical symbols and children.
			return true
		}
	}

	return false
}