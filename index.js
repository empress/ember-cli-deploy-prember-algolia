'use strict';

const algoliasearch = require('algoliasearch');
const compareVersions = require('compare-versions');
const flatten = require('lodash.flatten');
const HtmlExtractor = require('algolia-html-extractor');

const { extname, join } = require('path');
const { readFileSync } = require('fs');

var BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-prember-algolia',

  createDeployPlugin: function(options) {
    var DeployPlugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: Object.freeze({
        tagsToExclude: '',
        cssSelector: 'p',
        headingSelector: 'h1,h2,h3,h4,h5,h6',
        batchSize: 1000
      }),

      requiredConfig: Object.freeze(['indexName', 'applicationId', 'apiKey']),

      upload: function(context) {
        var client = algoliasearch(this.readConfig('applicationId'), this.readConfig('apiKey'));
        var index = client.initIndex(this.readConfig('indexName'));
        var indicesSoFar = [];
        var collect= function(indices) {
          indicesSoFar.concat(indices);

          if (indicesSoFar.length >= this.readConfig('batchSize')) {
            return pushAndClear();
          }
        };
        var pushAndClear = function() {

          return new Promise(function(resolve, reject) {
            index.addObjects(indicesSoFar, (err) => {
              if(err) {
                this.log('Error uploading the index', { color: 'red' });
                this.log(err, { color: 'red' })
                return reject(err);
              }
              indicesSoFar= [];
              resolve();
            });
          });

        };

        const Extractor = new HtmlExtractor();

        let files = context.distFiles
          .filter(path => extname(path) === '.html');

        let promise = files.reduce((previous, currentFile) => {
          previous.then(() => {
            const content = readFileSync(join(context.distDir, currentFile), 'utf8');
            const records = Extractor.run(content, {
              tagsToExclude: this.readConfig('tagsToExclude'),
              cssSelector: this.readConfig('cssSelector'),
              headingSelector: this.readConfig('headingSelector'),
            });

            if (this.readConfig('versionPattern')) {
              let match = currentFile.match(this.readConfig('versionPattern'));

              if(match) {
                let version = match[1];

                if(!this.readConfig('versionsToIgnore').some(ignoreVersion => compareVersions(version, ignoreVersion))) {
                  return Promise.resolve();
                }

                records.forEach((record) => {
                  record.version = version
                })
              }
            }

            records.forEach(record => {
              if (this.readConfig('pathPattern')) {
                let match = currentFile.match(this.readConfig('pathPattern'));

                if(match) {
                  record.path = match[1];
                }
              } else {
                record.path = currentFile
              }
            })

            return collect(records);
          });
        }, Promise.resolve());
        return promise.then(() => pushAndClear())
      },
    });

    return new DeployPlugin();
  }
};
