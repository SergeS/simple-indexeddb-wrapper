/* global console, Promise */

function getIndexedDB( root ) {
  return root.indexedDB || root.mozIndexedDB || root.webkitIndexedDB || root.msIndexedDB;
}

function getIDBTransaction( root ) {
  return root.IDBTransaction || root.webkitIDBTransaction || root.msIDBTransaction || { READ_WRITE: 'readwrite' };
}

function getIDBKeyRange( root ) {
  return root.IDBKeyRange || root.webkitIDBKeyRange || root.msIDBKeyRange;
}

( function registerModule( root, IndexedDbFactory ) {
  var
    indexedDB = getIndexedDB( root ),
    IDBTransaction = getIDBTransaction( root ),
    IDBKeyRange = getIDBKeyRange( root );

  function tryAngular() {
    if ( typeof root.angular === 'undefined' ) {
      return false;
    }

    try {
      root.angular.module( 'simple-indexeddb-wrapper', [ 'cursor-async' ] ).factory( 'IndexedDb', [ '$q', 'CursorAsync', function AngularIndexedDbFactory( $q, CursorAsync ) {
        return IndexedDbFactory( $q, CursorAsync, indexedDB, IDBTransaction, IDBKeyRange );
      } ] );

      return true;
    } catch ( e ) {
      console.error( 'Failed to init simple-indexeddb-wrapper with angular', e );
      return false;
    }
  }

  if ( !indexedDB ) {
    console.error( 'Failed to init simple-indexeddb-wrapper - indexedDB is not supported' );
    return;
  }

  if ( tryAngular() ) {
    return;
  }

  if ( !root.CursorAsync ) {
    console.error( 'Failed to init simple-indexeddb-wrapper - missing cursor-async module' );
    return;
  }

  root.IndexedDbWrapper = IndexedDbFactory( Promise, root.CursorAsync, indexedDB, IDBTransaction, IDBKeyRange );
} )( this, function IndexedDbFactory( promise, CursorAsync, indexedDB, IDBTransaction, IDBKeyRange ) {
  if ( !promise ) {
    console.error( 'Failed to init simple-indexeddb-wrapper - no promise mechanism found' );
    return;
  }

  function getCursotInterface( target, startFnc ) {
    var i;

    for ( i in CursorAsync.prototype ) {
      ( function getCursorFunction( name ) {
        target[ name ] = function getAndLaunchCursor() {
          var cursor = new CursorAsync();

          startFnc( cursor );

          return cursor[ name ].apply( cursor, arguments );
        }
      } )( i );
    }
  }

  function IndexQueryBuilder( db, name, indexName ) {
    var options = {};
    
    if( indexName) {
      ['gt', 'lt'].forEach(function addQueryBuilderMethod(methodName) {
        function comparisionMethod(value, include) {
          options[methodName] = value;
          options[methodName + 'e'] = !!include;
          delete options.eq;
          return this;
        }
        
        this[methodName] = comparisionMethod.bind(this);

        this[methodName + 'e'] = function comparisionMethodE(value) {
          return comparisionMethod.call(this, value, true);
        }.bind(this);
      }.bind(this));

      this.eq = function eqMethod(value) {
        options.eq = value;
        delete options.gt;
        delete options.lt;
        return this;
      }.bind(this);
    } else {
      this.limit = function limitMethod(start, end, startIncl, endIncl) {
        options.gt = start;
        options.gte = startIncl;
        options.lt = end;
        options.lte = endIncl;
        return this;
      }.bind(this);
    }
    
    this.reverse = function reverseMethod() {
      options.reverse = !options.reverse;
      return this;
    }.bind(this);

    function startCursor( outCursor ) { 
      var keyRange;
      
      if(typeof options.eq !== "undefined") {
        keyRange = IDBKeyRange.only(options.eq);
      } else if(typeof options.gt !== "undefined") {
        if(typeof options.lt !== "undefined") {
          keyRange = IDBKeyRange.bound(options.gt, options.lt, !options.gte, !options.lte);
        } else {
          keyRange = IDBKeyRange.lowerBound(options.gt, !options.gte);
        }
      } else if(typeof options.lt !== "undefined") {
        keyRange = IDBKeyRange.upperBound(options.lt, !options.lte);
      }
      
      db.then( function startCursorFunc( dbInstance ) {
        var request = dbInstance.transaction( name ).objectStore( name )
        if(indexName) {
          request = request.index(indexName);
        }
        
        request = request.openCursor(keyRange, options.reverse ? "prev" : "next");
        
        request.onsuccess = function collectionCursorFunc( event ) {
          var cursor = event.target.result;
          if (cursor) {
            outCursor.push(cursor.value);
            cursor.continue();
          } else {
            outCursor.end();
          }
        }

        request.onerror = outCursor.error;
      });
    }
    
    getCursotInterface( this, startCursor );
  }

  function Collection( db, name ) {
    function get( id ) {
      return db.then( function getFunc( dbInstance ) {
        return new promise( function getPromise( resolve, reject ) {
          var request = db.transaction( name ).objectStore( name ).get( id );

          request.onsuccess = function getFuncScucces( event ) {
            resolve( event.target.result );
          }

          request.onerror = reject;
        } );
      } )
    }
    
    function index(indexName) {
      return new IndexQueryBuilder(db, name, indexName);
    }
    
    function reverse() {
      return new IndexQueryBuilder(db, name).reverse();
    }

    function limit(start, end) {
      return new IndexQueryBuilder(db, name).limit(start, end, true, true);
    }

    function save( record ) {
      return db.then( function saveFunc( dbInstance ) {
        return new promise( function savePromise( resolve, reject ) {
          var request = dbInstance.transaction( name, 'readwrite' ).objectStore( name ).put( record );

          request.onsuccess = function saveFuncScucces( event ) {
            console.log( event.target.result );
            record.id = event.target.result;
            resolve(record);
          }

          request.onerror = reject;
        } );
      } )
    }

    function startCursor( outCursor ) { 
      db.then( function startCursorFunc( dbInstance ) {
        var request = dbInstance.transaction( name ).objectStore( name ).openCursor();
        
        request.onsuccess = function collectionCursorFunc( event ) {
          var cursor = event.target.result;
          if (cursor) {
            outCursor.push(cursor.value);
            cursor.continue();
          } else {
            outCursor.end();
          }
        }

        request.onerror = outCursor.error;
      });
    }

    getCursotInterface( this, startCursor );

    this.get = get;
    this.save = save;
    this.index = index;
    this.reverse = reverse;
    this.limit = limit;
  }

  function IndexedDbWrapper( name, version, model ) {
    if ( !( this instanceof IndexedDbWrapper ) ) {
      return new IndexedDbWrapper( name, version, model );
    }

    init.call( this, name, version, model );
  }

  function init( name, version, model ) {
    var
      db = new promise( connect.bind( this ) ),
      i,
      collections = [];

    for ( i in model ) {
      ( function registerCollection( collectionName, collectionModel ) {
        var 
          obj,
          keyN,
          keyPath,
          indexes = [],
          autoIncrement = false;
        
        for(keyN in collectionModel) {
          (function processModelItem(name, options) {
            if(options.primary) {
              keyPath = name;
              if(options.autoIncrement) {
                autoIncrement = true;
              }
              return ;
            }
            
            if(!options.index) {
              return ;
            }
            
            indexes.push({ name : name , options : { unique : !!options.unique}});
          })(keyN, collectionModel[keyN]);
        }
          
        obj = new Collection( db, collectionName );
        
        collections.push( {
          obj: obj,
          model: model[ collectionName ],
          name: collectionName,
          keyPath : keyPath,
          indexes : indexes,
          autoIncrement : autoIncrement
        } );

        Object.defineProperty( this, collectionName, {
          'get': function collectionGetter() {
            return obj;
          },
          'set': function collectionSetter() { }
        } )
      }.bind( this ) )( i, model[ i ] );
    }

    function connect( resolve, reject ) {
      var dbRequest = indexedDB.open( name, version );

      dbRequest.onupgradeneeded = function connectionCheckSchema( event ) {
        var 
          upgradeDb = event.target.result,
          upgradeTransaction = event.target.transaction;

        collections.forEach( function connectionCheckCollection( collection ) {
          var 
            collectionObjectStore;

          try {
            collectionObjectStore = upgradeTransaction.objectStore( collection.name );
          } catch(e) {
            if(e.name !== "NotFoundError") {
              throw e;  
            }
            
            collectionObjectStore = upgradeDb.createObjectStore( collection.name, { autoIncrement : collection.autoIncrement, keyPath : collection.keyPath } );
          }

          collection.indexes.forEach(function connectionCheckCollectionKey( index ) {
            try {
              collectionObjectStore.createIndex(index.name, index.name, index.options);
            } catch(e) {
              if(e.name !== "ConstraintError") {
                throw e;
              } 
            }
          } );
        } );
      };

      dbRequest.onerror = function connectionError( err ) {
        console.error( err );
        if ( this.onerror ) {
          this.onerror( err );
        }
        reject( err );
      }.bind( this );

      dbRequest.onsuccess = function connectionSuccess( event ) {
        resolve( event.target.result );
      };
    }
  }

  return IndexedDbWrapper;
} );
