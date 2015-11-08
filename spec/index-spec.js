/* jslint node: true */
/* global describe, it, expect */

"use strict";

var testUtil = require("./test-util");

describe("index.js", function () {

    it("- test import/require and export timeout", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            
            try {
                jenkins.require('pluginA:mathUtils');
            } catch (e) {
                expect(e).toBe("Unable to perform synchronous 'require' for module 'pluginA:mathUtils'. This module is not pre-loaded. The module needs to have been asynchronously pre-loaded via an outer call to 'import'.");
            }
            
            // should fail because a export never happens
            jenkins.setRegisterTimeout(100);
            jenkins.import('pluginA:mathUtils')
                .onRejected(function(error) {
                    expect(error.reason).toBe('timeout');
                    expect(error.detail).toBe("Timed out waiting on module 'pluginA:mathUtils' to load.");
                    done();               
                });
        });
    });

    it("- test import/require and export async successful", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            
            // Require before the module is registered.
            // The require should "trigger" the loading of the module from the plugin.
            // Should pass because export will happen before the timeout
            jenkins.import('pluginA:mathUtils', 2000).onFulfilled(function(module) {
                expect(module.add(2,2)).toBe(4);
                done();               
            }); // timeout before Jasmine does
            
            // Try requiring the module again immediately. Should be ignored i.e. a second
            // <script> element should NOT be added to the dom. See the test at the end
            // of this method.
            jenkins.import('pluginA:mathUtils', 1000).onFulfilled(function(module) {
            });
            
            // Check that the <script> element was added to the <head>
            var internal = require("../js/internal");
            var document = require('window-handle').getWindow().document;
            var moduleId = internal.toModuleId('pluginA', 'mathUtils') + ':js';
            
            var scriptEl = document.getElementById(moduleId);            
            
            expect(scriptEl).toBeDefined();
            expect(scriptEl.getAttribute('src')).toBe('/jenkins/plugin/pluginA/jsmodules/mathUtils.js');
                        
            // Now mimic registering of the plugin module. In real Jenkins land, this would happen
            // async. The call to "require" would trigger the plugin js to be loaded
            // via adding of a <script> element to the page DOM. That plugin module
            // is then responsible for calling 'export', which should trigger
            // the notify etc
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
            
            // Verify that only one <script> element was added to the dom. Remove the one we found and
            // attempt to find another with the same id - we should fail.
            internal.getHeadElement().removeChild(scriptEl);
            scriptEl = document.getElementById(moduleId);
            expect(scriptEl).toBe(null);
            
            // Make sure we can synchronously get the module.
            var mathUtils = jenkins.require('pluginA:mathUtils');
            expect(mathUtils).toBeDefined();
        });
    });

    it("- test import and export sync successful", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");

            // Register the module before calling require. See above test too.
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
            
            // Should pass immediately because export has already happened.
            jenkins.import('pluginA:mathUtils', 0).onFulfilled(function(module) {
                expect(module.add(2,2)).toBe(4);
                done();               
            }); // disable async load mode
            
        });
    });

    it("- test import and export async successful", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            var internal = require("../js/internal");
            
            // Require before the modules are registered.
            // The require should "trigger" the loading of the module from the plugin.
            // Should pass because export will happen before the timeout
            jenkins.setRegisterTimeout(2000);
            jenkins.import('pluginA:mathUtils', 'pluginB:timeUtils')
                .onFulfilled(function(mathUtils, timeUtils) {
                    // This function should only be called once both modules have been exported
                    expect(mathUtils.add(2,2)).toBe(4);
                    expect(timeUtils.now().getTime()).toBe(1000000000000);
                    
                    // The mathUtils module should be in the 'global' namespace
                    var moduleNamespace = internal.getModuleNamespace({namespace: 'pluginA', moduleName: 'mathUtils'});
                    expect(moduleNamespace.globalNS).toBe(false);

                    done();               
                }); // timeout before Jasmine does
            
            // Now mimic registering of the plugin modules.
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
            jenkins.export('pluginB', 'timeUtils', {
                now: function() {
                    return new Date(1000000000000);
                }
            });
        });
    });

    it("- test import and export sync successful", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            
            // Register the plugin modules before requiring.
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
            jenkins.export('pluginB', 'timeUtils', {
                now: function() {
                    return new Date(1000000000000);
                }
            });
            
            // Now require.
            // Should pass immediately because export has already happened for each plugin.
            jenkins.setRegisterTimeout(0);
            jenkins.import('pluginA:mathUtils', 'pluginB:timeUtils') // disable async load mode
                .onFulfilled(function(mathUtils, timeUtils) {
                    // This function should only be called once both modules have been exported
                    expect(mathUtils.add(2,2)).toBe(4);
                    expect(timeUtils.now().getTime()).toBe(1000000000000);
                    done();               
                }); // timeout before Jasmine does
        });
    });

    it("- test import via global '_internal'", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            var internal = require("../js/internal");
            
            // Require before the modules are registered.
            // The require should "trigger" the loading of the module from the plugin.
            // Should pass because export will happen before the timeout
            jenkins.setRegisterTimeout(2000);
            var _internal = internal.getJenkins()._internal;
            _internal.import('pluginA:mathUtils')
                .onFulfilled(function(mathUtils) {
                    // This function should only be called once both modules have been exported
                    expect(mathUtils.add(2,2)).toBe(4);
                    done();               
                }); // timeout before Jasmine does
            
            // Now mimic registering of the plugin modules.
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
        });
    });
    
    it("- test import and export global namespace async successful", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            var internal = require("../js/internal");
            
            // Require before the modules are registered.
            // The require should "trigger" the loading of the module.
            // Should pass because export will happen before the timeout
            jenkins.setRegisterTimeout(2000);
            jenkins.import('mathUtils', 'timeUtils')
                .onFulfilled(function(mathUtils, timeUtils) {
                    // This function should only be called once both modules have been exported
                    expect(mathUtils.add(2,2)).toBe(4);
                    expect(timeUtils.now().getTime()).toBe(1000000000000);
                    
                    // The mathUtils module should be in the 'global' namespace
                    var moduleNamespace = internal.getModuleNamespace({moduleName: 'mathUtils'});                    
                    expect(moduleNamespace.globalNS).toBe(true);
                    
                    done();               
                }); // timeout before Jasmine does
            
            // Now mimic registering of the global modules (plugin name undefined).
            jenkins.export(undefined, 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
            jenkins.export(undefined, 'timeUtils', {
                now: function() {
                    return new Date(1000000000000);
                }
            });
        });
    });    
    
    it("- test import and export global/plugin namespace async without module", function (done) {
        
        // This test is simply testing that we can async wait for a module that doesn't export
        // anything to load. Sounds strange, but we actually need something like this in Jenkins.
        // E.g. to support backward compatibility, we want adjuncts to wait for the 
        // 'jenkins-backcompat' bundle to load before they execute. The 'jenkins-backcompat' bundle
        // may or may not export functions (not always relevant), but it does register stuff in the
        // global/window JS namespace that legacy adjuncts need, so we need to make sure it is done
        // loading before we let the adjunct execute.
        
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            var internal = require("../js/internal");
            
            // Require before the modules are registered.
            // The require should "trigger" the loading of the module.
            // Should pass because export will happen before the timeout
            jenkins.setRegisterTimeout(2000);
            // 2 modules, the first is in the global namespace and the second is in a 
            // plugin namespace ('pluginB')
            jenkins.import('mathUtils', 'pluginB:timeUtils')
                .onFulfilled(function(mathUtils, timeUtils) {
                    expect(mathUtils).toBeDefined();
                    expect(timeUtils).toBeDefined();
                    done();               
                }); // timeout before Jasmine does
            
            // Now mimic registering of the modules, but without actual "modules" i.e. 3rd param not defined.
            jenkins.export(undefined, 'mathUtils');
            jenkins.export('pluginB', 'timeUtils');
        });
    });   
    
    it("- test addScript without 'data-replaceable' attribute", function (done) {
        testUtil.onJenkinsPage(function() {
            var internal = require("../js/internal");
            var document = require('window-handle').getWindow().document;

            var scriptId = 'adjunct:path/to/script.js';
            var jsEl = document.getElementById(scriptId);

            expect(jsEl).toBe(null);
            
            jsEl = internal.addScript('path/to/script.js', scriptId);
            expect(jsEl).toBeDefined();
            expect(jsEl.getAttribute('src')).toBe('/jenkins/path/to/script.js');
            
            // Trying to add another <script> of the same id should fail
            // because the existing <script> doesn't have a 'data-replaceable="true"'
            // attribute.
            
            var jsEl2 = internal.addScript('path/to/script.js', scriptId);
            expect(jsEl2).not.toBeDefined();
            
            done();
        });
    });
    
    it("- test addScript with 'data-replaceable' attribute", function (done) {
        testUtil.onJenkinsPage(function() {
            var internal = require("../js/internal");
            var document = require('window-handle').getWindow().document;

            var scriptId = 'adjunct:path/to/script.js';
            var jsEl = document.getElementById(scriptId);

            expect(jsEl).toBe(null);
            jsEl = internal.addScript('path/to/script.js', {scriptId: scriptId}); // use an config object
            expect(jsEl).toBeDefined();
            expect(jsEl.parentNode).toBe(internal.getHeadElement());
            
            // add the 'data-replaceable' attribute
            jsEl.setAttribute('data-replaceable', 'true');
            
            // Now when we try to add another <script> of the same id, it will
            // work because the existing <script> has a 'data-replaceable="true"'
            // attribute.
            
            var jsEl2 = internal.addScript('path/to/script.js', {scriptId: scriptId}); // use an config object
            expect(jsEl2).toBeDefined(); // addScript worked?
            expect(jsEl2).not.toBe(jsEl); // and it's not the original of the same id?
            
            // and the original jsEl should no longer be attached to the 
            // document head i.e. should have been deleted.
            expect(jsEl.parentNode).not.toBe(internal.getHeadElement());
            
            done();
        });
    });
    
    it("- test addScript with URL mapping/transform", function (done) {
        testUtil.onJenkinsPage(function() {
            var internal = require("../js/internal");
            var document = require('window-handle').getWindow().document;

            var scriptId = 'adjunct:path/to/script.js';
            var jsEl = document.getElementById(scriptId);

            expect(jsEl).toBe(null);
            jsEl = internal.addScript('path/to/script.js', {
                scriptId: scriptId,
                scriptSrcMap: [
                    {from: 'to/script.js', to: 'to/some/other/script.js'}
                ]
            });
            expect(jsEl).toBeDefined();
            expect(jsEl.getAttribute('src')).toBe('/jenkins/path/to/some/other/script.js');
            
            done();
        });
    });
    
    it("- test addModuleCSSToPage", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            var internal = require("../js/internal");
            var document = require('window-handle').getWindow().document;

            var cssEl = document.getElementById(internal.toModuleId('pluginA', 'mathUtils') + ':css');
            expect(cssEl).toBe(null);
            
            jenkins.addModuleCSSToPage('pluginA', 'mathUtils');
            cssEl = document.getElementById(internal.toModuleId('pluginA', 'mathUtils') + ':css');
            expect(cssEl).toBeDefined();
            expect(cssEl.getAttribute('href')).toBe('/jenkins/plugin/pluginA/jsmodules/mathUtils/style.css');
            
            done();
        });
    });
    
    it("- test addPluginCSSToPage", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            var internal = require("../js/internal");
            var document = require('window-handle').getWindow().document;

            var cssEl = document.getElementById('jenkins-plugin:pluginA::css:css/mathUtils.css');            
            expect(cssEl).toBe(null);
            
            jenkins.addPluginCSSToPage('pluginA', 'css/mathUtils.css');
            cssEl = document.getElementById('jenkins-plugin:pluginA::css:css/mathUtils.css');
            expect(cssEl).toBeDefined();
            expect(cssEl.getAttribute('href')).toBe('/jenkins/plugin/pluginA/css/mathUtils.css');
            
            done();
        });
    });

    it("- test rootURL/resURL not defined", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            }, function (e) {
                expect(e).toBe("Attribute 'resURL' not defined on the document <head> element.");
                done();
            });
        }, '<html><head></head></html>');
    });

    it("- test rootURL/resURL defined", function (done) {
        testUtil.onJenkinsPage(function() {
            var jenkins = require("../js/index");
            jenkins.setRootURL('/jenkins')
            jenkins.export('pluginA', 'mathUtils', {
                add: function(lhs, rhs) {
                    return lhs + rhs;
                }
            });
            done();
        }, '<html><head></head></html>');
    });
});
