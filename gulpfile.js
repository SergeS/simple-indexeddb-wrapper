/* global require, __dirname */

const
  gulp = require( 'gulp' ),
  jasmine = require( 'gulp-jasmine' ),
  eslint = require( 'gulp-eslint' ),
  uglify = require( 'gulp-uglify' ),
  rename = require( 'gulp-rename' ),
  concat = require( 'gulp-concat' ),
  reporters = require( 'jasmine-reporters' ),
  cursorAsyncPath = require.resolve( 'cursor-async.js' );

gulp.task( 'default', [ 'check', 'build' ] );
gulp.task( 'check', [ 'eslint', 'test' ] );
gulp.task( 'build', [ 'build-bundle', 'build-normal' ] );

gulp.task( 'build-bundle', [ 'concat-bundle' ], () => {
  return gulp.src( `${__dirname}/simple-indexeddb-wrapper.bundle.js` )
    .pipe( uglify() )
    .pipe( rename( 'simple-indexeddb-wrapper.bundle.min.js' ) )
    .pipe( gulp.dest( __dirname ) )
    ;
} );

gulp.task( 'build-normal', () => {
  return gulp.src( `${__dirname}/simple-indexeddb-wrapper.js` )
    .pipe( uglify() )
    .pipe( rename( 'simple-indexeddb-wrapper.min.js' ) )
    .pipe( gulp.dest( __dirname ) )
    ;
} );

gulp.task( 'concat-bundle', () => {
  return gulp.src( [ cursorAsyncPath, `${__dirname}/simple-indexeddb-wrapper.js` ] )
    .pipe( concat( 'simple-indexeddb-wrapper.bundle.js' ) )
    .pipe( gulp.dest( __dirname ) )
    ;
} );

gulp.task( 'eslint', () => {
  return gulp.src( [ `${__dirname}/**/*.js`, `!${__dirname}/node_modules/**/*.js`, `!${__dirname}/**/*.min.js`, `!${__dirname}/**/*.bundle.js` ], { base: __dirname } )
    .pipe( eslint( { fix: true } ) )
    .pipe( eslint.format() )
    .pipe( gulp.dest( __dirname ) )
    .pipe( eslint.failAfterError() )
    ;
} );

gulp.task( 'test', () => {
  return gulp.src( [ `${__dirname}/spec/**/*.js` ] )
    .pipe( jasmine( {
      reporter: new reporters.JUnitXmlReporter( {
        savePath: `${__dirname}/test-results`
      } )
    } ) )
} );
