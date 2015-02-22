var g = require('../grammar')

var Category = require('./category')
var stopwords = require('./stopWords')
var oneSg = require('./oneSg')
var prep = require('./prepositions')


var user = new Category('user')

var users = new g.Symbol('users')
users.addRule({ RHS: [ user.plural ] })

var start = new g.Symbol('start')
start.addRule({ RHS: [ users ]})


var peopleTerm = new g.Symbol('people', 'term')
peopleTerm.addRule({ RHS: [ 'people' ]})
peopleTerm.addRule({ RHS: [ 'users' ]})

var github = new g.Symbol('github')
github.addRule({ RHS: [ g.emptyTermSym ] })
github.addRule({ RHS: [ 'GitHub' ] }) // both accepted, though FB doesn't

// Github users (I follow)
user.head.addRule({ RHS: [ github, peopleTerm ] })

// (people) I (follow)
var nomUsers = new g.Symbol('nom', 'users')
nomUsers.addRule({ RHS: [ oneSg.plain ] })

// FOLLOW:
var follow = new g.Symbol('follow')
follow.addRule({ RHS: [ 'follow' ]})
follow.addRule({ RHS: [ 'followed' ]})
follow.addRule({ RHS: [ 'am|is|are|were|was|be following' ]}) // rejected
follow.addRule({ RHS: [ 'have followed' ]}) // rejected

// (people I) follow
var stopwordFollow = new g.Symbol('stopword', 'follow')
stopwordFollow.addRule({ RHS: [ stopwords.preVerbStopwords, follow ] })

// (people) I follow
user.objFilter.addRule({ RHS: [ nomUsers, stopwordFollow ] })


// (people followed by) me
var objUser = new g.Symbol('obj', 'user')
objUser.addRule({ RHS: [ oneSg.plain ] })

var objUsers = new g.Symbol('obj', 'users')
objUsers.addRule({ RHS: [ objUser ]})

var objUsersPlus = new g.Symbol('obj', 'users+')
objUsersPlus.addRule({ RHS: [ objUsers ]})

// (people followed) by me
var byObjUsers = new g.Symbol('by', 'obj', 'users')
byObjUsers.addRule({ RHS: [ prep.agent, objUsersPlus ]})

// (people) followed by me
user.passive.addRule({ RHS: [ follow, byObjUsers ] })