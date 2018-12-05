var METHODS = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options'];
var CREATE_METHODS = ['post', 'patch', 'put'];
const swaggerSpecValidator = require('swagger-spec-validator');
const _ = require('lodash');

var counter = 0;

var getDefaultParameterLocation = function(method) {
  if (method === 'post' || method === 'patch' || method === 'put') return 'formData';
  return 'query';
}

var deepSort = require('deep-sort-object');
var urlParser = require('url');
var fs = require('fs');
var async = require('async');
var request = require('request');
var cheerio = require('cheerio');
var generateSchema = require('json-schema-generator');
var argv = require('yargs').argv;
if (argv.name) {
  argv.config = __dirname + '/config/' + argv.name + '.js';
  argv.output = __dirname + '/output/' + argv.name + '.swagger.json';
}
var config = require(argv.config);
let locs = config.defaultParameterLocations = config.defaultParameterLocations || {};
METHODS.forEach(m => locs[m] = locs[m] || getDefaultParameterLocation(m));

var swagger = {
  swagger: '2.0',
  paths: {},
  info: {},
  host: config.host,
  basePath: config.basePath,
  securityDefinitions: config.securityDefinitions,
};

var parsed = urlParser.parse(config.url);
var host = parsed.protocol + '//' + parsed.host;

var log = function() {
  if (argv.verbose) console.log.apply(console, arguments);
}

function scrapeInfo(url, callback) {
  request.get(url, function(err, resp, body) {
    if (err) return callback(err);
    var $ = cheerio.load(body);
    var body = $('body');
      //console.log("$1="+$);

    var base = ['basePath', 'host']
    var info = ['title', 'description', 'version'];
    base.forEach(function(i) {swagger[i] = extractText(body, config[i])})
    info.forEach(function(i) {swagger.info[i] = extractText(body, config[i])})
    swagger.schemes = config.schemes || ['https'];
    callback();
  })
}

var scrapedPages = [];

function scrapePage(url, depth, callback) {
  // The logic in belows if-statement should be generalized instead of containing a hard-coded String
  if (!host.includes('bugzilla.readthedocs.io/en/latest/api/core/v1/')) {
      host = host.replace('bugzilla.readthedocs.io','bugzilla.readthedocs.io/en/latest/api/core/v1/');
  }
  url = urlParser.resolve(host, url);
  if (url.indexOf('mailto:') === 0) return callback();
  if (scrapedPages.indexOf(url) !== -1) return callback();
  if (config.urlRegex && !url.match(config.urlRegex)) return callback();
  scrapedPages.push(url);
  log('scrape', url);
  request.get(url, function(err, resp, body) {
    if (err) return callback(err);
    let $ = cheerio.load(body);

      wrapDivsAround($);
      //console.log('$='+$);

      // const myTables = [];
      // $('table').each(function(i, elem0) {
      //   myTables[i] = $(this);
      //   const myParagraphs = [];
      //
      //   $(this).prevAll('p').find('strong').each(function(j, elem1) {
      //       if ( elem1.firstChild != 'null' && elem1.firstChild.data  == 'Request' ) {
      //           console.log("found Request paragraph for " + $(this));
      //       }
      //   });
      //
      // });

//      var myRequests = $('p strong:contains(Request)').parent().nextUntil('p strong:contains(Response)');
//       var myTables = $('table');
//
//
//       var counter = 0;
//       for (var myTable in myTables) {
//
//         var myTablePrevAlls = myTable.prevAll('p').find('strong');
//         for (var myTablePrevAll in myTablePrevAlls) {
//           if (myTablePrevAll.text() == 'Request') {
//             console.log("found Request paragraph for " + myTable);
//           }
//         }
//
//         console.log('myTable['+counter+']='+myTable);
//         counter += 1;
//       }
    // modify page and annotate request and response tables before continuing here
    //   var myRequestStrings = $('body').html().split("<strong>Request</strong>");
    //
    //   for (var myRequestString in myRequestStrings) {
    //     if ('null' != myRequestString ) {
    //       var myRequest = cheerio.load(myRequestString);
    //       myRequest.par
    //     }
    //   }

    // var tables = $('table.docutils');
    // console.log("tables="+tables);
    //   var test = $('p strong:');
    //   console.log("test="+test);
    //console.log("$2="+$);

    addPageToSwagger($);
    if (!depth) return callback();
    var links = $('a[href]');
    async.series($('a[href]').map(function(i, el) {
      return function(acb) {
        scrapePage($(el).attr('href'), depth - 1, acb);
      }
    }), function(err) {
      callback(err);
    })
  })
}

function wrapDivsAround($) {
    // for each Request, create a div and put Request and every sibling of Request, until Response, inside the same div

    // look for occurrence of Request
    $('p strong').each(function(i, elem0) {

        if ( elem0.firstChild != 'null' && elem0.firstChild.data  == 'Request' ) {
           // close previous response-div
            if ( $(this).parent('response-div') ) {
              console.log('closing response-div');
                $(this).before('</div>');
                console.log('');
              //return $;

            }

            // open new request-div
            console.log('open new request-div');
            $(this).before('<div class="request-div">')

            $(this).parent().nextAll('p').find('strong').each(function(j, elem1) {
                if ( elem1.firstChild != 'null' && elem1.firstChild.data  == 'Response' ) {
                    // close current request-div
                    console.log('close current request-div');
                    $(this).before('</div>');
                    // open new response-div
                    console.log('open new response-div');
                    $(this).after('<div class="response-div">');
                    // operate on the rest
                    return wrapDivsAround($);
                }
            });

        }

    });
}

function addPageToSwagger($) {
  var body = $('body');
  operations = resolveSelector(body, config.operations, $);
  operations = resolveSelector(operations, config.operation, $);
  operations.each(function() {
    var op = $(this);
    var method = extractText(op, config.method);
    var path = extractText(op, config.path);

    // The logic in belows if-statement should be generalized instead of containing a hard-coded String
    if (path.includes('/rest/')) {
        path = path.replace('/rest/','/');
    }
    path = path.replace("(", "{").replace(")","}"); // replace (..) with {..}
    path = path.replace("<", "{").replace(">","}"); // replace <..> with {..}

      // path = path.replace(/\(([^)]+)\)/i, ""); // remove everything enclosed with rounded brackets (not a fix!)
    // path = path.replace("//", "/"); // remove double-slashes (result of previous line)
    // if (path.endsWith("/")) {
    //   path = path.substring(0,path.length-1); // replace trailing slash
    // }

    log('  op', method, path);
    if (!method || !path) return;
    method = method.toLowerCase();
    if (METHODS.indexOf(method) === -1) return;
    var parsed = urlParser.parse(path, true);
    path = parsed.pathname;
    if (!path.startsWith('/')) path = '/' + path;
    if (config.fixPathParameters) path = config.fixPathParameters(path, $, resolveSelector(op, config.path));
    var paths = Array.isArray(path) ? path : [path];
    paths.forEach(function(path) {
      addOperationToSwagger($, op, method, path, parsed.query);
    });
  });
}

function addOperationToSwagger($, op, method, path, qs) {
  var sPath = swagger.paths[path] = swagger.paths[path] || {};
  var sOp = sPath[method] = sPath[method] || {parameters: [], responses: {}};
  sOp.summary = extractText(op, config.operationSummary) || undefined;
  sOp.description = extractText(op, config.operationDescription) || undefined;
  for (var key in qs) {
    sOp.parameters.push({
      name: key,
      type: 'string',
      in: 'query',
    })
  }

  var parameters = resolveSelector(op, config.parameters, $);
  parameters = resolveSelector(parameters, config.parameter, $);
  let bodyParam = null;
  var body = extractJSON(op, config.requestBody);
  if (body) {
    log('    param', 'body');
    bodyParam = {name: 'body', in: 'body', schema: body};
  }
  var bodyFields = resolveSelector(op, config.requestBodyFields);
  if (config.requestBodyFields && bodyFields && bodyFields.length) {
    bodyParam = {name: 'body', in: 'body', schema: {type: 'object', properties: {}}};
    props = bodyParam.schema.properties;
    bodyFields.each(function() {
      var field = $(this);
      var schema = {};
      var name = extractText(field, config.parameterName);
      if (!name) return;
      var description = extractText(field, config.parameterDescription);
      if (description) schema.description = description.trim();
      schema.type = extractText(field, config.parameterType).toLowerCase();
      if (schema.type === 'array') {
        schema.items = {type: 'string'};
        if (config.parameterArrayType) {
          schema.items.type = extractText(field, config.parameterArrayType).toLowerCase();
        }
      }
      if (config.requestBodyFieldsEnum) {
        var enm = resolveSelector(field, config.requestBodyFieldsEnum);
        enm = resolveSelector(enm, config.requestBodyFieldsEnumValues);
        if (enm.length) {
          schema.enum = [];
          enm.each(function() {
            schema.enum.push($(this).text());
          })
          schema.enum = _.uniq(schema.enum);
        }
      }
      props[name] = schema;
    })
  }
  if (parameters) parameters.each(function() {
    var param = $(this);
    var name = extractText(param, config.parameterName);
    log('    param', name);
    if (!name) {
      log('      no name!')
      return;
    }
    var sParameter = {name: name};
    var description = extractText(param, config.parameterDescription);
    if (description) sParameter.description = description.trim();
    var required = extractBoolean(param, config.parameterRequired);
    if (required === true || required === false) sParameter.required = required;
    sParameter.type = extractText(param, config.parameterType).toLowerCase() || 'string';
    if (sParameter.type === 'array') {
      sParameter.items = {type: 'string'};
      if (config.parameterArrayType) {
        sParameter.items.type = extractText(param, config.parameterArrayType).toLowerCase() || 'string';
      }
    }
    if (config.parameterEnum) {
      var enm = resolveSelector(param, config.parameterEnum);
      enm = resolveSelector(enm, config.parameterEnumValues);
      if (enm.length) {
        sParameter.enum = [];
        enm.each(function() {
          var val = $(this);
          sParameter.enum.push(val.text());
        })
        sParameter.enum = _.uniq(sParameter.enum);
      }
    }
    if (path.match(new RegExp('\\{' + sParameter.name + '\\}'))) {
      sParameter.in = 'path';
    } else {
      sParameter.in = extractText(param, config.parameterIn) || config.defaultParameterLocations[method];
    }
    if (sParameter.in === 'field') {
      bodyParam = bodyParam || {name: 'body', in: 'body', schema: {properties: {}}};
      bodyParam.schema.properties = bodyParam.schema.properties || {};
      bodyParam.schema.properties[sParameter.name] = bodyParam.schema.properties[sParameter.name] || {type: sParameter.type};
      sParameter = null;
    }
    if (sParameter) sOp.parameters.push(sParameter);
  });
  if (bodyParam) {
    sOp.parameters.push(bodyParam);
  }

  var responses = resolveSelector(op, config.responses, $).first();
  responses = resolveSelector(responses, config.response, $);
  responses.each(function() {
    var response = $(this);
    var responseStatus = extractInteger(response, config.responseStatus) || 200;
    log('    resp', responseStatus);
    var responseDescription = extractText(response, config.responseDescription);
    var responseSchema = extractJSON(response, config.responseSchema);
    sOp.responses[responseStatus] = {
        description: responseDescription || '',
        schema: responseSchema || undefined,
    };
  });
  if (Object.keys(sOp.responses).length === 0) {
    sOp.responses.default = {'description': 'Unknown'};
  }
}

function resolveSelector(el, extractor, $) {
  if (!extractor) return el;
  if (extractor.sibling) return el.nextAll(extractor.selector).eq(0);
  if (extractor.split) {
    return el.find(extractor.selector).map(function() {
      var elementSet = $(this).nextUntil(extractor.selector).addBack().map(function() {return $.html($(this))}).toArray();
      var elementSetHTML = elementSet.join(' ');
      return $('.scrape-wrapper', '<div class="scrape-wrapper">' + elementSetHTML + '</div>');
    })
  }
  return el.find(extractor.selector);
}

function extractText(el, extractor) {
  if (!extractor) return '';
  if (typeof extractor === 'string') return extractor;
  var el = resolveSelector(el, extractor);
  var text =
        extractor.parse ? extractor.parse(el.first())
      : extractor.join ? el.map(function() {return cheerio(this).text()}).toArray().join(' ')
      : el.first().text();
  if (extractor.regex) {
    var matches = text.match(extractor.regex);
    if (!matches) return '';
    text = matches[extractor.regexMatch || 1];
  }
  return (text || '').trim();
}

function fixSchema(schema) {
  if (!schema) return schema;
  delete schema['$schema'];
  if (schema.required && !schema.required.length) delete schema.required;
  if (schema.properties) {
    for (let key in schema.properties) fixSchema(schema.properties[key]);
  }
  if (schema.items) {
    fixSchema(schema.items);
  }
  return schema;
}

function extractJSON(el, extractor) {
  var json = extractText(el, extractor);
  if (!json) return;
  try {
    json = JSON.parse(json);
  } catch (e) {
    console.log('failed to parse', json);
    json = undefined;
  }
  if (!json) return;
  if (extractor.isExample) {
    json = generateSchema(json);
    fixSchema(json);
  }
  return json;
}

function extractBoolean(el, extractor) {
  var text = extractText(el, extractor);
  if (!text) return;
  text = text.toLowerCase();
  if (text === 'false' || text === 'no') return false;
  return true;
}

function extractInteger(el, extractor) {
  var text = extractText(el, extractor);
  if (!text) return;
  return parseInt(text);
}

function fixErrors() {
  for (var path in swagger.paths) {
    for (var method in swagger.paths[path]) {
      var op = swagger.paths[path][method];
      op.parameters = op.parameters.filter(function(p) {
        var bestParamWithName = op.parameters.filter(function(p2) {
          return p2.name === p.name
        }).sort(function(p1, p2) {
          if (p1.in === 'query' && !p2.in === 'query') return 1;
          if (p2.in === 'query' && !p1.in === 'query') return -1;
          if (p1.schema && !p2.schema) return -1;
          if (p2.schema && !p1.schema) return 1;
          if (p1.type && !p2.type) return -1;
          if (p2.type && !p1.type) return 1;
          if (p1.schema && p2.schema) {
            var p1len = JSON.stringify(p1.schema).length;
            var p2len = JSON.stringify(p2.schema).length;
            if (p1len > p2len) return -1;
            if (p1len < p2len) return 1;
          }
          return 0;
        })[0];
        if (p !== bestParamWithName) {
          console.log('dropping parameter', p.name, 'in', method, path);
        }
        return p === bestParamWithName;
      }).sort(function(p1, p2) {
        if (p1.name < p2.name) return -1;
        if (p1.name > p2.name) return 1;
        return 0;
      })
      var processedPath = path;
      while (match = /{([^}]*?)}/.exec(processedPath)) {
        var paramName = match[1];
        processedPath = processedPath.replace(match[0], paramName);
        var origParam = op.parameters.filter(function(p) {return p.name === paramName})[0];
        if (origParam) {
          origParam.in = 'path';
          origParam.required = true;
        }
        else op.parameters.push({in: 'path', name: paramName, type: 'string', required: true})
      }

      if (config.deduplicateBodyParameter) {
        var bodyParam = op.parameters.filter(function(p) {return p.in === 'body'})[0];
        if (bodyParam && bodyParam.schema) {
          var props = bodyParam.schema.properties || {};
          op.parameters = op.parameters.filter(function(p) {
            if (props[p.name]) return false;
            return true;
          })
        }
      }
    }
  }
  if (config.fixup) config.fixup(swagger);
}

scrapeInfo(config.url, function(err) {
  if (err) throw err;
  scrapePage(config.url, config.depth === 0 ? 0 : (config.depth || 1), function(err) {
    if (err) throw err;
    fixErrors();
    outputFile = argv.output || './swagger.json';
    fs.writeFileSync(outputFile, JSON.stringify(deepSort(swagger), null, 2));
    if (argv.validate) {
      swaggerSpecValidator.validateFile(outputFile)
          .then(result => {
            if (Object.keys(result).length === 0) {
              console.log('Spec is valid');
            } else {
              console.log('Spec is invalid');
            }
          })
    }
  });
});
