/* */ 
'use strict';
Object.defineProperty(exports, '__esModule', {value: true});
var _createClass = (function() {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ('value' in descriptor)
        descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  return function(Constructor, protoProps, staticProps) {
    if (protoProps)
      defineProperties(Constructor.prototype, protoProps);
    if (staticProps)
      defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();
exports.validate = validate;
exports.visitUsingRules = visitUsingRules;
function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};
    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key))
          newObj[key] = obj[key];
      }
    }
    newObj['default'] = obj;
    return newObj;
  }
}
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {'default': obj};
}
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}
var _jsutilsInvariant = require('../jsutils/invariant');
var _jsutilsInvariant2 = _interopRequireDefault(_jsutilsInvariant);
var _error = require('../error/index');
var _languageVisitor = require('../language/visitor');
var _languageKinds = require('../language/kinds');
var Kind = _interopRequireWildcard(_languageKinds);
var _typeSchema = require('../type/schema');
var _utilitiesTypeInfo = require('../utilities/TypeInfo');
var _specifiedRules = require('./specifiedRules');
function validate(schema, ast, rules) {
  (0, _jsutilsInvariant2['default'])(schema, 'Must provide schema');
  (0, _jsutilsInvariant2['default'])(ast, 'Must provide document');
  (0, _jsutilsInvariant2['default'])(schema instanceof _typeSchema.GraphQLSchema, 'Schema must be an instance of GraphQLSchema. Also ensure that there are ' + 'not multiple versions of GraphQL installed in your node_modules directory.');
  var typeInfo = new _utilitiesTypeInfo.TypeInfo(schema);
  return visitUsingRules(schema, typeInfo, ast, rules || _specifiedRules.specifiedRules);
}
function visitUsingRules(schema, typeInfo, documentAST, rules) {
  var context = new ValidationContext(schema, documentAST, typeInfo);
  var visitors = rules.map(function(rule) {
    return rule(context);
  });
  (0, _languageVisitor.visit)(documentAST, (0, _languageVisitor.visitWithTypeInfo)(typeInfo, (0, _languageVisitor.visitInParallel)(visitors)));
  return context.getErrors();
}
var ValidationContext = (function() {
  function ValidationContext(schema, ast, typeInfo) {
    _classCallCheck(this, ValidationContext);
    this._schema = schema;
    this._ast = ast;
    this._typeInfo = typeInfo;
    this._errors = [];
    this._fragmentSpreads = new Map();
    this._recursivelyReferencedFragments = new Map();
    this._variableUsages = new Map();
    this._recursiveVariableUsages = new Map();
  }
  _createClass(ValidationContext, [{
    key: 'reportError',
    value: function reportError(error) {
      this._errors.push(error);
    }
  }, {
    key: 'getErrors',
    value: function getErrors() {
      return this._errors;
    }
  }, {
    key: 'getSchema',
    value: function getSchema() {
      return this._schema;
    }
  }, {
    key: 'getDocument',
    value: function getDocument() {
      return this._ast;
    }
  }, {
    key: 'getFragment',
    value: function getFragment(name) {
      var fragments = this._fragments;
      if (!fragments) {
        this._fragments = fragments = this.getDocument().definitions.reduce(function(frags, statement) {
          if (statement.kind === Kind.FRAGMENT_DEFINITION) {
            frags[statement.name.value] = statement;
          }
          return frags;
        }, {});
      }
      return fragments[name];
    }
  }, {
    key: 'getFragmentSpreads',
    value: function getFragmentSpreads(node) {
      var spreads = this._fragmentSpreads.get(node);
      if (!spreads) {
        spreads = [];
        var setsToVisit = [node.selectionSet];
        while (setsToVisit.length !== 0) {
          var set = setsToVisit.pop();
          for (var i = 0; i < set.selections.length; i++) {
            var selection = set.selections[i];
            if (selection.kind === Kind.FRAGMENT_SPREAD) {
              spreads.push(selection);
            } else if (selection.selectionSet) {
              setsToVisit.push(selection.selectionSet);
            }
          }
        }
        this._fragmentSpreads.set(node, spreads);
      }
      return spreads;
    }
  }, {
    key: 'getRecursivelyReferencedFragments',
    value: function getRecursivelyReferencedFragments(operation) {
      var fragments = this._recursivelyReferencedFragments.get(operation);
      if (!fragments) {
        fragments = [];
        var collectedNames = Object.create(null);
        var nodesToVisit = [operation];
        while (nodesToVisit.length !== 0) {
          var _node = nodesToVisit.pop();
          var spreads = this.getFragmentSpreads(_node);
          for (var i = 0; i < spreads.length; i++) {
            var fragName = spreads[i].name.value;
            if (collectedNames[fragName] !== true) {
              collectedNames[fragName] = true;
              var fragment = this.getFragment(fragName);
              if (fragment) {
                fragments.push(fragment);
                nodesToVisit.push(fragment);
              }
            }
          }
        }
        this._recursivelyReferencedFragments.set(operation, fragments);
      }
      return fragments;
    }
  }, {
    key: 'getVariableUsages',
    value: function getVariableUsages(node) {
      var _this = this;
      var usages = this._variableUsages.get(node);
      if (!usages) {
        (function() {
          usages = [];
          var typeInfo = new _utilitiesTypeInfo.TypeInfo(_this._schema);
          (0, _languageVisitor.visit)(node, (0, _languageVisitor.visitWithTypeInfo)(typeInfo, {
            VariableDefinition: function VariableDefinition() {
              return false;
            },
            Variable: function Variable(variable) {
              usages.push({
                node: variable,
                type: typeInfo.getInputType()
              });
            }
          }));
          _this._variableUsages.set(node, usages);
        })();
      }
      return usages;
    }
  }, {
    key: 'getRecursiveVariableUsages',
    value: function getRecursiveVariableUsages(operation) {
      var usages = this._recursiveVariableUsages.get(operation);
      if (!usages) {
        usages = this.getVariableUsages(operation);
        var fragments = this.getRecursivelyReferencedFragments(operation);
        for (var i = 0; i < fragments.length; i++) {
          Array.prototype.push.apply(usages, this.getVariableUsages(fragments[i]));
        }
        this._recursiveVariableUsages.set(operation, usages);
      }
      return usages;
    }
  }, {
    key: 'getType',
    value: function getType() {
      return this._typeInfo.getType();
    }
  }, {
    key: 'getParentType',
    value: function getParentType() {
      return this._typeInfo.getParentType();
    }
  }, {
    key: 'getInputType',
    value: function getInputType() {
      return this._typeInfo.getInputType();
    }
  }, {
    key: 'getFieldDef',
    value: function getFieldDef() {
      return this._typeInfo.getFieldDef();
    }
  }, {
    key: 'getDirective',
    value: function getDirective() {
      return this._typeInfo.getDirective();
    }
  }, {
    key: 'getArgument',
    value: function getArgument() {
      return this._typeInfo.getArgument();
    }
  }]);
  return ValidationContext;
})();
exports.ValidationContext = ValidationContext;
