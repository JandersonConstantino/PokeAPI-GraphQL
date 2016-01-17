/* */ 
'use strict';
var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];
var _slicedToArray = require('babel-runtime/helpers/sliced-to-array')['default'];
var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];
var RelayProfiler = require('./RelayProfiler');
var filterExclusiveKeys = require('./filterExclusiveKeys');
var readRelayQueryData = require('./readRelayQueryData');
var recycleNodesInto = require('./recycleNodesInto');
var GraphQLStoreQueryResolver = (function() {
  function GraphQLStoreQueryResolver(storeData, fragmentPointer, callback) {
    _classCallCheck(this, GraphQLStoreQueryResolver);
    this.reset();
    this._callback = callback;
    this._fragmentPointer = fragmentPointer;
    this._resolver = null;
    this._storeData = storeData;
  }
  GraphQLStoreQueryResolver.prototype.reset = function reset() {
    if (this._resolver) {
      this._resolver.reset();
    }
  };
  GraphQLStoreQueryResolver.prototype.resolve = function resolve(fragmentPointer) {
    var resolver = this._resolver;
    if (!resolver) {
      resolver = this._fragmentPointer.getFragment().isPlural() ? new GraphQLStorePluralQueryResolver(this._storeData, this._callback) : new GraphQLStoreSingleQueryResolver(this._storeData, this._callback);
      this._resolver = resolver;
    }
    return resolver.resolve(fragmentPointer);
  };
  return GraphQLStoreQueryResolver;
})();
var GraphQLStorePluralQueryResolver = (function() {
  function GraphQLStorePluralQueryResolver(storeData, callback) {
    _classCallCheck(this, GraphQLStorePluralQueryResolver);
    this.reset();
    this._callback = callback;
    this._storeData = storeData;
  }
  GraphQLStorePluralQueryResolver.prototype.reset = function reset() {
    if (this._resolvers) {
      this._resolvers.forEach(function(resolver) {
        return resolver.reset();
      });
    }
    this._resolvers = [];
    this._results = [];
  };
  GraphQLStorePluralQueryResolver.prototype.resolve = function resolve(fragmentPointer) {
    var prevResults = this._results;
    var nextResults;
    var nextIDs = fragmentPointer.getDataIDs();
    var prevLength = prevResults.length;
    var nextLength = nextIDs.length;
    var resolvers = this._resolvers;
    while (resolvers.length < nextLength) {
      resolvers.push(new GraphQLStoreSingleQueryResolver(this._storeData, this._callback));
    }
    while (resolvers.length > nextLength) {
      resolvers.pop().reset();
    }
    if (prevLength !== nextLength) {
      nextResults = [];
    }
    for (var ii = 0; ii < nextLength; ii++) {
      var nextResult = resolvers[ii].resolve(fragmentPointer, nextIDs[ii]);
      if (nextResults || ii >= prevLength || nextResult !== prevResults[ii]) {
        nextResults = nextResults || prevResults.slice(0, ii);
        nextResults.push(nextResult);
      }
    }
    if (nextResults) {
      this._results = nextResults;
    }
    return this._results;
  };
  return GraphQLStorePluralQueryResolver;
})();
var GraphQLStoreSingleQueryResolver = (function() {
  function GraphQLStoreSingleQueryResolver(storeData, callback) {
    _classCallCheck(this, GraphQLStoreSingleQueryResolver);
    this.reset();
    this._callback = callback;
    this._garbageCollector = storeData.getGarbageCollector();
    this._storeData = storeData;
    this._subscribedIDs = {};
  }
  GraphQLStoreSingleQueryResolver.prototype.reset = function reset() {
    if (this._subscription) {
      this._subscription.remove();
    }
    this._hasDataChanged = false;
    this._fragment = null;
    this._result = null;
    this._resultID = null;
    this._subscription = null;
    this._updateGarbageCollectorSubscriptionCount({});
    this._subscribedIDs = {};
  };
  GraphQLStoreSingleQueryResolver.prototype.resolve = function resolve(fragmentPointer, nextPluralID) {
    var nextFragment = fragmentPointer.getFragment();
    var prevFragment = this._fragment;
    var nextID = nextPluralID || fragmentPointer.getDataID();
    var prevID = this._resultID;
    var nextResult;
    var prevResult = this._result;
    var subscribedIDs;
    if (prevFragment != null && prevID != null && this._getCanonicalID(prevID) === this._getCanonicalID(nextID)) {
      if (prevID !== nextID || this._hasDataChanged || !nextFragment.isEquivalent(prevFragment)) {
        var _resolveFragment2 = this._resolveFragment(nextFragment, nextID);
        var _resolveFragment22 = _slicedToArray(_resolveFragment2, 2);
        nextResult = _resolveFragment22[0];
        subscribedIDs = _resolveFragment22[1];
        nextResult = recycleNodesInto(prevResult, nextResult);
      } else {
        nextResult = prevResult;
      }
    } else {
      var _resolveFragment3 = this._resolveFragment(nextFragment, nextID);
      var _resolveFragment32 = _slicedToArray(_resolveFragment3, 2);
      nextResult = _resolveFragment32[0];
      subscribedIDs = _resolveFragment32[1];
    }
    if (prevResult !== nextResult) {
      if (this._subscription) {
        this._subscription.remove();
        this._subscription = null;
      }
      if (subscribedIDs) {
        subscribedIDs[nextID] = true;
        var changeEmitter = this._storeData.getChangeEmitter();
        this._subscription = changeEmitter.addListenerForIDs(_Object$keys(subscribedIDs), this._handleChange.bind(this));
        this._updateGarbageCollectorSubscriptionCount(subscribedIDs);
        this._subscribedIDs = subscribedIDs;
      }
      this._resultID = nextID;
      this._result = nextResult;
    }
    this._hasDataChanged = false;
    this._fragment = nextFragment;
    return this._result;
  };
  GraphQLStoreSingleQueryResolver.prototype._getCanonicalID = function _getCanonicalID(id) {
    return this._storeData.getRangeData().getCanonicalClientID(id);
  };
  GraphQLStoreSingleQueryResolver.prototype._handleChange = function _handleChange() {
    if (!this._hasDataChanged) {
      this._hasDataChanged = true;
      this._callback();
    }
  };
  GraphQLStoreSingleQueryResolver.prototype._resolveFragment = function _resolveFragment(fragment, dataID) {
    var _readRelayQueryData = readRelayQueryData(this._storeData, fragment, dataID);
    var data = _readRelayQueryData.data;
    var dataIDs = _readRelayQueryData.dataIDs;
    return [data, dataIDs];
  };
  GraphQLStoreSingleQueryResolver.prototype._updateGarbageCollectorSubscriptionCount = function _updateGarbageCollectorSubscriptionCount(nextDataIDs) {
    if (this._garbageCollector) {
      var garbageCollector = this._garbageCollector;
      var prevDataIDs = this._subscribedIDs;
      var _filterExclusiveKeys = filterExclusiveKeys(prevDataIDs, nextDataIDs);
      var _filterExclusiveKeys2 = _slicedToArray(_filterExclusiveKeys, 2);
      var removed = _filterExclusiveKeys2[0];
      var added = _filterExclusiveKeys2[1];
      added.forEach(function(id) {
        return garbageCollector.increaseSubscriptionsFor(id);
      });
      removed.forEach(function(id) {
        return garbageCollector.decreaseSubscriptionsFor(id);
      });
    }
  };
  return GraphQLStoreSingleQueryResolver;
})();
RelayProfiler.instrumentMethods(GraphQLStoreQueryResolver.prototype, {resolve: 'GraphQLStoreQueryResolver.resolve'});
module.exports = GraphQLStoreQueryResolver;
