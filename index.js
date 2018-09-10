'use strict';

const algoliasearch = require('algoliasearch');
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
        tagsToExclude: ''
      }),

      requiredConfig: Object.freeze(['indexName', 'applicationId', 'apiKey']),

      upload: function(context) {
        var client = algoliasearch(this.readConfig('applicationId'), this.readConfig('apiKey'));
        var index = client.initIndex(this.readConfig('indexName'));

        const Extractor = new HtmlExtractor();

        const files = context.distFiles.filter(path => extname(path) === '.html');

        const promises = files.map((file) => {
          const content = readFileSync(join(context.distDir, file), 'utf8');
          const records = Extractor.run(content, {
            tagsToExclude: this.readConfig('tagsToExclude'),
          });

          return new Promise(function(resolve, reject) {
            index.addObjects(records, (err) => {
              if(err) {
                return reject(err);
              }

              resolve();
            });
          });
        });

        return Promise.all(promises);
      },
    });

    return new DeployPlugin();
  }
};
