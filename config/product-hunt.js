var config = module.exports = {
  url: 'https://api.producthunt.com/v1/docs/',
  host: 'api.producthunt.com',
  basePath: '/v1',
  title: 'Product Hunt API',
  description: {selector: ''},
  operation: {selector: '.api--content'},
  path: {selector: '.api--request pre:first-of-type', regex: /\w+ (.*)/},
  pathParameters: [
    {name: 'id', regex: /^\d+$/},
    {name: 'id', regex: /l33thaxor/},
  ],  
  method: {selector: '.api--request pre:first-of-type', regex: /(\w+) .*/},
  parameters: {selector: 'table'},
  parameter: {selector: 'tr'},
  parameterName: {selector: 'td:first-of-type', regex: /(\w+)( required)?/},
  parameterDescription: {selector: 'td:nth-of-type(2)'},
}
