'use strict'

var util = require('util')
var objcHelpers = require('./helpers')

module.exports = function (source, options) {
  var opts = util._extend({
    timeout: '10',
    indent: '    ',
    pretty: true
  }, options)

  var code = []

  var req = {
    hasHeaders: false,
    hasBody: false
  }

  var indent = opts.indent

  code.push('#import <Foundation/Foundation.h>')

  if (Object.keys(source.allHeaders).length) {
    req.hasHeaders = true
    code.push(null)
    code.push(objcHelpers.nsDictionaryBuilder('headers', source.allHeaders, opts.pretty))
  }

  if (source.postData.text || source.postData.jsonObj || source.postData.params) {
    req.hasBody = true

    switch (source.postData.mimeType) {
      case 'application/x-www-form-urlencoded':
        code.push(null)
        // Makes it easier to implement logice than just putting the entire body string
        code.push(util.format('NSMutableData *postData = [[NSMutableData alloc] initWithData:[@"%s=%s" dataUsingEncoding:NSUTF8StringEncoding]];', source.postData.params[0].name, source.postData.params[0].value))
        for (var i = 1, len = source.postData.params.length; i < len; i++) {
          code.push(util.format('[postData appendData:[@"&%s=%s" dataUsingEncoding:NSUTF8StringEncoding]];', source.postData.params[i].name, source.postData.params[i].value))
        }
        break

      case 'application/json':
        if (source.postData.jsonObj) {
          code.push(objcHelpers.nsDictionaryBuilder('parameters', source.postData.jsonObj, opts.pretty))
          code.push(null)
          code.push('NSData *postData = [NSJSONSerialization dataWithJSONObject:parameters options:0 error:nil];')
        }
        break

      case 'multipart/form-data':
        code.push(objcHelpers.nsArrayBuilder('parameters', source.postData.params, opts.pretty))
        code.push(util.format('NSString *boundary = @"%s";', source.postData.boundary))
        code.push(null)
        code.push('NSError *error;')
        code.push('NSMutableString *body = [NSMutableString string];')
        code.push('for (NSDictionary *param in parameters) {')
        code.push(indent + '[body appendFormat:@"--%@\\r\\n", boundary];')
        code.push(indent + 'if (param[@"fileName"]) {')
        code.push(indent + indent + '[body appendFormat:@"Content-Disposition:form-data; name=\\"%@\\"; filename=\\"%@\\"\\r\\n", param[@"name"], param[@"fileName"]];')
        code.push(indent + indent + '[body appendFormat:@"Content-Type: %@\\r\\n\\r\\n", param[@"contentType"]];')
        code.push(indent + indent + '[body appendFormat:@"%@", [[NSString alloc] initWithContentsOfFile:param[@"fileName"]')
        code.push(indent + indent + '                                                          encoding:NSUTF8StringEncoding error:&error]];')
        code.push(indent + indent + 'if (error) {')
        code.push(indent + indent + indent + 'NSLog(@"%@", error);')
        code.push(indent + indent + '}')
        code.push(indent + '} else {')
        code.push(indent + indent + '[body appendFormat:@"Content-Disposition:form-data; name=\\"%@\\"\\r\\n\\r\\n", param[@"name"]];')
        code.push(indent + indent + '[body appendFormat:@"%@", param[@"value"]];')
        code.push(indent + '}')
        code.push('}')
        code.push('[body appendFormat:@"\\r\\n--%@--\\r\\n", boundary];')
        code.push('NSData *postData = [[NSData alloc] initWithData:[body dataUsingEncoding:NSUTF8StringEncoding]];')
        break

      default:
        code.push(null)
        code.push('NSData *postData = [[NSData alloc] initWithData:[@"' + source.postData.text + '" dataUsingEncoding:NSUTF8StringEncoding]];')
    }
  }

  code.push(null)
  code.push('NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@"' + source.fullUrl + '"]')
  code.push('                                                       cachePolicy:NSURLRequestUseProtocolCachePolicy')
  code.push('                                                   timeoutInterval:' + parseInt(opts.timeout, 10).toFixed(1) + '];')
  code.push('[request setHTTPMethod:@"' + source.method + '"];')

  if (req.hasHeaders) {
    code.push('[request setAllHTTPHeaderFields:headers];')
  }

  if (req.hasBody) {
    code.push('[request setHTTPBody:postData];')
  }

  code.push(null)
  code.push('NSURLSession *session = [NSURLSession sharedSession];') // Retrieve shared session for simplicity
  code.push('NSURLSessionDataTask *dataTask = [session dataTaskWithRequest:request')
  code.push('                                            completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {')
  code.push('                                            ' + indent + 'if (error) {')
  code.push('                                            ' + indent + indent + 'NSLog(@"%@", error);')
  code.push('                                            ' + indent + '} else {')
  code.push('                                            ' + indent + indent + 'NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *) response;')
  code.push('                                            ' + indent + indent + 'NSLog(@"%@", httpResponse);')
  code.push('                                            ' + indent + '}')
  code.push('                                            }];')
  code.push('[dataTask resume];')

  return code.join('\n')
}

module.exports.info = {
  key: 'native',
  title: 'NSURLSession',
  link: 'https://developer.apple.com/library/mac/documentation/Foundation/Reference/NSURLSession_class/index.html',
  description: 'Foundation\'s NSURLSession request'
}
