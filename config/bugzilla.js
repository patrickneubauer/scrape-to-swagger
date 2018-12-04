const VALID_TYPES = ['int','double','string','email','date','datetime','boolean','base64','array','object']; // see: https://bugzilla.readthedocs.io/en/latest/api/core/v1/general.html#common-data-types

var config = module.exports = {
  depth: 3,
  url: 'https://bugzilla.readthedocs.io/en/latest/api/core/v1',
  urlRegex: /^https:\/\/bugzilla.readthedocs.io\/en\/latest\/api\/core\/v1/,
  protocols: ['https'],
  host: 'bugzilla.mozilla.org',
  basePath: '/rest/',
  title: 'BugZilla Mozilla API',
  version: 'latest',
  description: 'The BugZilla Mozilla API',
  securityDefinitions: {}, // implement fix or set manually (see: https://bugzilla.readthedocs.io/en/latest/api/core/v1/general.html#authentication)

  operations: {selector: '.content'},
  operations: {selector: '.section'},
  // operations: {selector: '.reference internal'},

  operation: {selector: 'h2', split: true},

  // path: {selector: 'pre:not(.highlight):not(.command-line) > code', regex: /\w+ (\/\S*)/},
  path: {selector: 'pre:not(.highlight):not(.command-line)', regex: /\w+ (\/\S*)/},

  // method: {selector: 'pre:not(.highlight):not(.command-line) > code', regex: /(\w+) .*/},
  method: {selector: 'pre:not(.highlight):not(.command-line)', regex: /(\w+) .*/},

  // parameters: {selector: 'h3:contains(Parameters) + table'},
  parameters: {selector: 'table.docutils'},

  // parameter: {selector: 'tbody tr'},
  parameter: {selector: 'tbody tr'},

  // parameterName: {selector: 'td:first-of-type', regex: /(\S+)/},
  parameterName: {selector: 'td:first-of-type', regex: /(\S+)/},

  // parameterType: {selector: 'td:nth-of-type(2)', regex: /(array|string|integer|boolean)/},
  parameterType: {selector: 'td:nth-of-type(2)', regex: /(string|integer|boolean)/}, // 'array' type will result in 'string' which should be fine (however, if a request wants to pass multiple values, they need to be manually separated by ',')

  // parameterDescription: {selector: 'td:nth-of-type(3)'},
  parameterDescription: {selector: 'td:nth-of-type(3)'},

  // requestBody: {selector: 'h4:contains(Example) ~ pre.highlight-json, h3:contains(Example) ~ pre.highlight-json', isExample: true},
  //requestBody: {selector: 'h4:contains(Example) ~ pre.highlight-json, h3:contains(Example) ~ pre.highlight-json', isExample: true},
  // (!) requestBody not available in BugZilla (at least in most cases)

  // responses: {selector: 'h3:contains(Response), h4:contains(Response)'},
  responses: {selector: 'p strong:contains(Response)'}, // beware: css contains selector is officially not available anymore (see: https://stackoverflow.com/questions/45955239/css3-contains-selector-not-work)

  // responseStatus: {selector: 'pre.highlight-headers', regex: /Status: (\d+) /, sibling: true},
  //responseStatus: {selector: 'pre.highlight-headers', regex: /Status: (\d+) /, sibling: true},
  // (!) responseStatus 200 OK but only described here: https://bugzilla.readthedocs.io/en/latest/api/core/v1/general.html

  // responseDescription: {selector: 'pre.highlight-headers', regex: /Status: \d+ (.*)/, sibling: true},
  //responseDescription: {selector: 'pre.highlight-headers', regex: /Status: \d+ (.*)/, sibling: true},
  // (!) responseDescription in BugZilla described in the same fashion as Requests, i.e. parameter name, type, description (no general description)

  // responseSchema: {selector: 'pre.highlight-json', isExample: true, sibling: true},
  responseSchema: {selector: '.highlight-js', isExample: true, sibling: true},

  defaultParameterLocations: {
    put: 'field',
    post: 'field',
    patch: 'field',
  },

  fixPathParameters: function(path) {
    pieces = path.split('/');
    pieces = pieces.map(function(p) {
      return p.replace(/:(\w+)/g, '{$1}')
    })
    return pieces.join('/');
  },
}
