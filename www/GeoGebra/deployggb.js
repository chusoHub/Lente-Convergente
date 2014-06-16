/**
 * (c) International GeoGebra Institute 2013
 * Licence for use: http://creativecommons.org/licenses/by-nc-nd/3.0/
 * For commercial use please see: http://www.geogebra.org/license
 *
 */

var ggbHTML5ScriptLoadInProgress = false;
var ggbHTML5ScriptLoadFinished = false;
var ggbHTML5LoadedCodebaseIsWebSimple = false;
var ggbHTML5LoadedCodebaseVersion = null;
var ggbHTML5LoadedScript = null;

/**
 * @param ggbVersion The version of the GeoGebraFile as string in the format x.x (e.g. '4.4')
 * @param parameters An object containing parameters that are passed to the applet.
 * @param views An object containing information about which views are used in the GeoGebra worksheet. Each variable is boolean.
 *              E.g.: {"is3D":false,"AV":false,"SV":false,"CV":false,"EV2":false,"CP":false,"PC":false,"DA":false,"FI":false,"PV":false,"macro":false};
 * @param html5NoWebSimple Set to true to avoid using web Simple for simple html5 applets. In this case the full version is used always.
 */
var GGBApplet = function() {
    var applet = {};

    // Define the parameters
    var ggbVersion = null;
    var parameters = {};
    var views = null;
    var html5NoWebSimple = false;
    var appletID = null;
    var initComplete = false;

    for(var i=0; i<arguments.length; i++) {
        var p = arguments[i];
        if (p != null) {
            switch(typeof(p)) {
                case 'number':
                    ggbVersion = p.toFixed(1);
                    break;
                case 'string':
                    // Check for a version number
                    if (p.match(new RegExp("^[0-9]\\.[0-9]+$"))) {
                        ggbVersion = p;
                    } else {
                        appletID = p;
                    }
                    break;
                case 'object':
                    if (typeof p.is3D != "undefined") {
                        views = p;
                    } else {
                        parameters = p;
                    }
                    break;
                case 'boolean':
                    html5NoWebSimple = p;
                    break;
            }
        }
    }

    if (views == null)
        views = {"is3D":false,"AV":false,"SV":false,"CV":false,"EV2":false,"CP":false,"PC":false,"DA":false,"FI":false,"PV":false,"macro":false};

    if (appletID != null && parameters.id == undefined) {
        parameters.id = appletID;
    }

    // Private members
    var jnlpFilePath = "";
    var html5Codebase = "";
    var javaCodebase = "";
    var isOverriddenJavaCodebase = false;
    var isHTML5Offline = false;
    var isJavaOffline = false;
    var loadedAppletType = null;
    var javaCodebaseVersion = null;
    var html5CodebaseVersion = null;
    var html5CodebaseScript = null;
    var html5CodebaseIsWebSimple = false;
    var previewImagePath = null;
    var previewLoadingPath = null;
    var fonts_css_url = null;
    var giac_js_url = null;
    var jnlpBaseDir = null;
    var preCompiledScriptPath = null;

    if (parameters.height != undefined)
        parameters.height = Math.round(parameters.height);
    if (parameters.width != undefined)
        parameters.width = Math.round(parameters.width);

    /**
     * Overrides the codebase for HTML5.
     * @param codebase Can be an URL or a local file path.
     * @param offline Set to true, if the codebase is a local URL and no web URL
     */
    applet.setHTML5Codebase = function(codebase, offline) {
        html5Codebase = codebase;

        if (offline == null) {
            offline = (codebase.indexOf("http") === -1);
        }
        isHTML5Offline = offline;

        // Set the scriptname (web or webSimple)
        html5CodebaseScript = "web.nocache.js";
        html5CodebaseIsWebSimple = false;
        if (! offline) { // Currently we don't use webSimple for offline worksheets
            var folders = html5Codebase.split("/");
            if (folders.length>0) {
                if (folders[folders.length-2] == 'webSimple') {
                    html5CodebaseScript = "webSimple.nocache.js";
                    html5CodebaseIsWebSimple = true;
                }
            }
        }

        // Extract the version from the codebase folder
        if (codebase.slice(-1) != '/') {
        	codebase += '/';
        }
        var folders = codebase.split('/');
        html5CodebaseVersion = folders[folders.length-3];
        if (html5CodebaseVersion.substr(0,4) == 'test') {
        	html5CodebaseVersion = html5CodebaseVersion.substr(4,1) + '.' + html5CodebaseVersion.substr(5,1);
        } else if (html5CodebaseVersion.substr(0,3) == 'war') {
            html5CodebaseVersion = '5.0';
        }
    };

    /**
     * Overrides the codebase version for Java.
     * @param version The version of the codebase that shoudl be used for java applets.
     */
    applet.setJavaCodebaseVersion = function(version) {
        javaCodebaseVersion = version;
        setDefaultJavaCodebaseForVersion(version);
    };

    /**
     * Overrides the codebase version for HTML5.
     * If another codebase than the default codebase should be used, this method has to be called before setHTML5Codebase.
     * @param version The version of the codebase that should be used for HTML5 applets.
     */
    applet.setHTML5CodebaseVersion = function(version) {
        html5CodebaseVersion = version;
        setDefaultHTML5CodebaseForVersion(version);
    };

    applet.getHTML5CodebaseVersion = function() {
        return html5CodebaseVersion;
    };


    /**
     * Overrides the codebase for Java.
     * @param codebase Can be an URL or a local file path.
     * @param offline Set to true, if the codebase is a local URL and no web URL
     */
    applet.setJavaCodebase = function(codebase, offline) {
        isOverriddenJavaCodebase = true;

        if (codebase.slice(-1) == '/') {
            javaCodebaseVersion = codebase.slice(-4,-1);
        } else {
            javaCodebaseVersion = codebase.slice(-3);
        }

        if (offline == null) {
            offline = (codebase.indexOf("http") === -1);
        }
        if (offline && jnlpBaseDir != null) {
            jnlpBaseDir = null;
        }

        doSetJavaCodebase(codebase, offline);
    };

    applet.setFontsCSSURL = function(url) {
        fonts_css_url = url;
    };

    applet.setGiacJSURL = function(url) {
        giac_js_url = url;
    };


    applet.toggleAppletTypeControls = function(parentSelector) {
        var currentAppletType = applet.getLoadedAppletType();
        var displayJava = "none"; displayHTML5 = "none";
        if (currentAppletType == "java" && applet.isHTML5Installed()) {
            displayHTML5 = "inline";
        } else if (currentAppletType == "html5" && applet.isJavaInstalled()) {
            displayJava = "inline";
        }

        var elem = document.querySelector(parentSelector + ' #view_as_Java');
        if (elem != null) elem.style.display = displayJava;
        elem = document.querySelector(parentSelector + ' #view_as_separator_Java');
        if (elem != null) elem.style.display = displayJava;

        elem = document.querySelector(parentSelector + ' #view_as_HTML5');
        if (elem != null) elem.style.display = displayHTML5;
        elem = document.querySelector(parentSelector + ' #view_as_separator_HTML5');
        if (elem != null) elem.style.display = displayHTML5;

    };

    var doSetJavaCodebase = function(codebase, offline) {
        javaCodebase = codebase;

        // Check if the codebase is online or local
        isJavaOffline = offline;

        // Set the name of the JNLP file to the codebase directory
        if (jnlpBaseDir == null) {
            var dir='';
            if (isJavaOffline) {
                var loc = window.location.pathname;
                dir = loc.substring(0, loc.lastIndexOf('/'))+'/';
            }
            applet.setJNLPFile(dir+codebase+'/'+buildJNLPFileName(isJavaOffline));
        } else {
            applet.setJNLPFile(jnlpBaseDir+javaCodebaseVersion+'/'+buildJNLPFileName(isJavaOffline));
        }
    };

    /**
     * Overrides the JNLP file to use.
     * By default (if this method is not called), the jnlp file in the codebase directory is used.
     * Cannot be used in combination with setJNLPBaseDir
     * @param newJnlpFilePath The absolute path to the JNLP file.
     */
    applet.setJNLPFile = function(newJnlpFilePath) {
        jnlpFilePath = newJnlpFilePath;
    };

    /**
     * Sets an alternative base directory for the JNLP File. The path must not include the version number.
     * @param baseDir
     */
    applet.setJNLPBaseDir = function(baseDir) {
        jnlpBaseDir = baseDir;
        applet.setJNLPFile(jnlpBaseDir+javaCodebaseVersion+'/'+buildJNLPFileName(isJavaOffline));
    };

    /**
     * Injects the applet;
     * @param containerID The id of the HTML element that is the parent of the new applet.
     * All other content (innerText) of the container will be overwritten with the new applet.
     * @param type Can be 'preferJava', 'preferHTML5', 'java', 'html5', 'auto' or 'screenshot'. Default='auto';
     * @param boolean noPreview. Set to true if no preview image should be shown
     * @return The type of the applet that was injected or null if the applet could not be injected.
     */
    applet.inject = function() {
        var type = 'auto';
        var container_ID = parameters.id;
        var noPreview = false;
        for(var i=0; i<arguments.length; i++) {
            var p = arguments[i];
            if (typeof(p) == "string") {
                p = p.toLowerCase();
                if (p == 'preferjava' || p == 'preferhtml5' || p == 'java' || p == 'html5' || p == 'auto' || p == 'screenshot' || p == 'prefercompiled' || p == 'compiled') {
                    type = p;
                } else {
                    container_ID = arguments[i];
                }
            } else if (typeof(p) == "boolean")
                noPreview = p;
        }

        continueInject();

        function continueInject() {
            // Check if the initialization is complete
            if (! initComplete) {
                // Try again in 500 ms.
                setTimeout(continueInject, 500);
                return;
            }

            // Use the container id as appletid, if it was not defined.
            type = detectAppletType(type); // Sets the type to either 'java' or 'html5'

            var appletElem = document.getElementById(container_ID);

            // Remove an existing applet
            applet.removeExistingApplet(appletElem, false);

            // Read the applet dimensions from the container, if they were not defined in the params
            if (parameters.width == undefined) {
                parameters.width = appletElem.clientWidth;
            }
            if (parameters.height == undefined) {
                parameters.height = appletElem.clientHeight;
            }

            // Inject the new applet
            loadedAppletType = type;
            if (type === "java") {
                injectJavaApplet(appletElem, parameters);
            } else if (type === "compiled") {
                injectCompiledApplet(appletElem, parameters);
            } else if (type === "screenshot") {
                injectScreenshot(appletElem, parameters);
            } else {
                injectHTML5Applet(appletElem, parameters, noPreview);
            }
        }

        return;
    };

    applet.getViews = function() {
        return views;
    }

    /**
     * @returns boolean Whether the system is capable of showing the GeoGebra Java applet
     */
    applet.isJavaInstalled = function() {
        if (typeof deployJava === 'undefined') {
            // incase deployJava.js not available
            if (navigator.javaEnabled()) {
                // Check if IE is in metro mode
                if (navigator.appName == 'Microsoft Internet Explorer' && getIEVersion() >= 10) {
                    if(window.innerWidth == screen.width && window.innerHeight == screen.height) {
                        return false;
                    }
                }
                return true;
            }
        } else {
            return (deployJava.versionCheck("1.6.0+") || deployJava.versionCheck("1.4") || deployJava.versionCheck("1.5.0*"));
        }
    };

    var fetchParametersFromTube = function(successCallback) {
        // load ggbbase64 string and settings from API
        var api_request = {
            "request": {
                "-api": "1.0.0",
                "task": {
                    "-type": "fetch",
                    "fields": {
                        "field": [
                            { "-name": "id" },
                            { "-name": "geogebra_format" },
//                            { "-name": "prefapplettype" },
                            { "-name": "width" },
                            { "-name": "height" },
                            { "-name": "toolbar" },
                            { "-name": "menubar" },
                            { "-name": "inputbar" },
                            { "-name": "reseticon" },
                            { "-name": "labeldrags" },
                            { "-name": "shiftdragzoom" },
                            { "-name": "rightclick" },
                            { "-name": "ggbbase64" }
                        ]
                    },
                    "filters" : {
                        "field": [
                            {
                                "-name":"id", "#text": ""+parameters.material_id+""
                            }
                        ]
                    },
                    "order": {
                        "-by": "id",
                        "-type": "asc"
                    },
                    "limit": { "-num": "1" }
                }
            }
        };

        // TODO: add prefapplet type (params:'type' API:'prefapplettype')

        success = function() {
            var text = xhr.responseText;
            var jsondata=eval("("+text+")"); //retrieve result as an JSON object
            var item = jsondata.responses.response.item;
            if (item == undefined) {
                onError();
                return;
            }

            ggbVersion = item.geogebra_format;
            if (parameters.ggbBase64 == undefined)
                parameters.ggbBase64 = item.ggbBase64;
            if (parameters.width == undefined)
                parameters.width = item.width;
            if (parameters.height == undefined)
                parameters.height = item.height;
            if (parameters.showToolBar == undefined)
                parameters.showToolBar = item.toolbar == "true";
            if (parameters.showMenuBar == undefined)
                parameters.showMenuBar = item.menubar == "true";
            if (parameters.showAlgebraInput == undefined)
                parameters.showAlgebraInput = item.inputbar == "true";
            if (parameters.showResetIcon == undefined)
                parameters.showResetIcon = item.reseticon == "true";
            if (parameters.enableLabelDrags == undefined)
                parameters.enableLabelDrags = item.labeldrags == "true";
            if (parameters.enableShiftDragZoom == undefined)
                parameters.enableShiftDragZoom = item.shiftdragzoom == "true";
            if (parameters.enableRightClick == undefined)
                parameters.enableRightClick = item.rightclick == "true";
            if (parameters.showToolBarHelp == undefined)
                parameters.showToolBarHelp =  parameters.showToolBar;

//            var views = {"is3D":false,"AV":false,"SV":false,"CV":false,"EV2":false,"CP":false,"PC":false,"DA":false,"FI":false,"PV":false,"macro":false};

            applet.setPreviewImage("http://www.geogebratube.org/files/material-"+item.id+".png", "http://www.geogebratube.org/images/GeoGebra_loading.png");

            successCallback();
        }

        var url = "http://www.geogebratube.org/api/json.php";
        var xhr = createCORSRequest('POST', url);

        var onError = function() {
            log("Error: The request for fetching material_id " + parameters.material_id + " from tube was not successful.");
        };

        if (!xhr) {
            onError();
            return;
        }

        // Response handlers.
        xhr.onload = success;
        xhr.onerror = onError;

        // Send request
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(JSON.stringify(api_request));
    };

    // Create the XHR object.
    function createCORSRequest(method, url) {
        var xhr = new XMLHttpRequest();
        if ("withCredentials" in xhr) {
            // XHR for Chrome/Firefox/Opera/Safari.
            xhr.open(method, url, true);
        } else if (typeof XDomainRequest != "undefined") {
            // XDomainRequest for IE.
            xhr = new XDomainRequest();
            xhr.open(method, url);
        } else {
            // CORS not supported.
            xhr = null;
        }
        return xhr;
    }


    /**
     * @return NULL if no version found. Else return some things like: '1.6.0_31'
     */
    var JavaVersion = function() {
        var resutl = null;
        // Walk through the full list of mime types.
        for( var i=0,size=navigator.mimeTypes.length; i<size; i++ )
        {
            // The jpi-version is the plug-in version.  This is the best
            // version to use.
            if( (resutl = navigator.mimeTypes[i].type.match(/^application\/x-java-applet;jpi-version=(.*)$/)) !== null )
                return resutl[1];
        }
        return null;
    };

    /**
     * @returns boolean Whether the system is capable of showing the GeoGebra HTML5 applet
     */
    applet.isHTML5Installed = function() {
        if (views.is3D || navigator.appName == 'Microsoft Internet Explorer' && getIEVersion() < 10) {
            return false;
        }
        return true;
    };

    /**
     * @returns The type of the loaded applet or null if no applet was loaded yet.
     */
    applet.getLoadedAppletType = function() {
        return loadedAppletType;
    };

    applet.setPreviewImage = function(previewFilePath, loadingFilePath) {
        previewImagePath = previewFilePath;
        previewLoadingPath = loadingFilePath;
    };

    applet.removeExistingApplet = function(appletParent, showScreenshot) {
        if (typeof appletParent == 'string') {
            appletParent = document.getElementById(appletParent);
        }
        loadedAppletType = null;
        for (var i=0; i<appletParent.childNodes.length;i++) {
            var tag = appletParent.childNodes[i].tagName;
            if (appletParent.childNodes[i].className == "applet_screenshot") {
                if (showScreenshot) {
                    // Show the screenshot instead of the removed applet
                    appletParent.childNodes[i].style.display = "block";
                    loadedAppletType = "screenshot";
                } else {
                    // Hide the screenshot
                    appletParent.childNodes[i].style.display = "none";
                }
            } else if (tag == "APPLET" || tag == "ARTICLE" || tag == "DIV") {
                // Remove the applet
                appletParent.removeChild(appletParent.childNodes[i]);
                i--;
            }
        }

        var appName = (parameters.id != undefined ? parameters.id : "ggbApplet");
        var app = window[appName];
        if (app != undefined) {
            eval(appName + "=null;");
        }
    };

    applet.refreshHitPoints = function() {
        var appName = (parameters.id != undefined ? parameters.id : "ggbApplet");
        var app = window[appName];
        if (app != undefined) {
            if (typeof app.recalculateEnvironments == "function") {
                app.recalculateEnvironments();
                return true;
            }
        }
        return false;
    };

    applet.setPreCompiledScriptPath = function(path) {
        preCompiledScriptPath = path;
    }

//    var validateJavaApplet = function(appletElem, container_ID) {
//        if ((typeof appletElem.isAnimationRunning) === 'undefined') {
//            log("Error: The GeoGebra Java applet could not be started. Used JNLP file = '"+jnlpFilePath+"'. Switching to HTML5 instead.");
//
//            // Try html5 instead
//            applet.inject(container_ID, 'html5');
//        }
//    }

    var injectJavaApplet = function(appletElem, parameters) {
        if (views.CV) {
//            if (views.CV && (navigator.appVersion.indexOf("Mac")!=-1 || navigator.appVersion.indexOf("Linux")!=-1 || navigator.appVersion.indexOf("X11")!=-1)) {
            // Load the javascript version of giac
            if (giac_js_url != null) {
                giac_url = giac_js_url;
            } else {
                giac_url = javaCodebase+'/giac.js';
            }
            var script = document.createElement("script");
            script.setAttribute("src", giac_url);


            setupGIAC = function() {
                _GIAC_caseval = __ggb__giac.cwrap('_ZN4giac7casevalEPKc', 'string', ['string']);
            }

            script.onload = setupGIAC;
            appletElem.appendChild(script);

            script = document.createElement("script");
            script.innerHTML = "" +
                "       var _GIAC_caseval = 'nD';" +
                "       function _ggbCallGiac(exp) {" +
                "           var ret = _GIAC_caseval(exp);" +
                "           return ret;" +
                "       }";
            appletElem.appendChild(script);
        }

        var applet = document.createElement("applet");
        applet.setAttribute("name", (parameters.id != undefined ? parameters.id : "ggbApplet"));
        applet.setAttribute("height", parameters.height);
        applet.setAttribute("width", parameters.width);
        applet.setAttribute("code", "dummy");

        appendParam(applet, "jnlp_href", jnlpFilePath);
        if (isOverriddenJavaCodebase) {
            appendParam(applet, "codebase", javaCodebase);
        }

        appendParam(applet, "boxborder", "false");
        appendParam(applet, "centerimage", "true");

        if(ggbVersion === "5.0")
            appendParam(applet, "java_arguments", "-Xmx1024m -Djnlp.packEnabled=false");
        else
            appendParam(applet, "java_arguments", "-Xmx1024m -Djnlp.packEnabled=true");

        // Add dynamic parameters
        for (var key in parameters) {
            if (key != 'width' && key != 'height') {
                appendParam(applet, key, parameters[key]);
            }
        }

        appendParam(applet, "framePossible", "false");
        if (! isJavaOffline)
            appendParam(applet, "image", "http://www.geogebra.org/webstart/loading.gif");

        appendParam(applet, "codebase_lookup", "false");

        if (navigator.appName != 'Microsoft Internet Explorer' || getIEVersion() > 9) {
            applet.appendChild(document.createTextNode("This is a Java Applet created using GeoGebra from www.geogebra.org - it looks like you don't have Java installed, please go to www.java.com"));
        }

        applet.style.display = "block";
        appletElem.appendChild(applet);

//        setTimeout(validateJavaApplet(appletElem, container_ID),5000);

        log("GeoGebra Java applet injected. Used JNLP file = '"+jnlpFilePath+"'"+(isOverriddenJavaCodebase?" with overridden codebase '"+javaCodebase+"'." : "."));
    };

    var appendParam = function(applet, name, value) {
        var param = document.createElement("param");
        param.setAttribute("name", name);
        param.setAttribute("value", value);
        applet.appendChild(param);
    };

    var injectHTML5Applet = function(appletElem, parameters, noPreview) {
        // Decide if the script has to be (re)loaded or renderGGBElement can be used to load the applet
        var loadScript = false;
        if (ggbHTML5ScriptLoadInProgress) { // Never reload the script when the script load is currently in progress
            loadScript = false;
        } else if (!ggbHTML5ScriptLoadFinished) { // Script was not loaded yet
            loadScript = true;
        } else if (ggbHTML5LoadedCodebaseVersion != html5CodebaseVersion || (ggbHTML5LoadedCodebaseIsWebSimple && !html5CodebaseIsWebSimple)) {
            // Reload the script when currently the wrong version is loaded
            loadScript = true;
        }
        var renderWithoutReload = ggbHTML5ScriptLoadFinished && typeof(renderGGBElement) == 'function';

        var article = document.createElement("article");
        var oriWidth = parameters.width;
        var oriHeight = parameters.height;

        // The HTML 5 version changes the height depending on which bars are shown. So we have to correct it here.
        if (parameters.width != undefined) {
            if (parseFloat(html5CodebaseVersion) >= 4.4) {
                if (parameters.showToolBar) {
                    parameters.height -= 7;
                }
                if (parameters.showAlgebraInput) {
                    parameters.height -= 37;
                }
            } else {
                if (parameters.showToolBar) {
                    parameters.height -= 59;
                }
                if (parameters.showMenuBar) {
                    parameters.height -= 34;
                }
                if (parameters.showAlgebraInput) {
                    parameters.height -= 34;
                    parameters.width -= 97;
                }
            }
        }
        article.className = "geogebraweb notranslate";
        article.style.border = 'none';
        article.style.display = 'inline-block';

        for (var key in parameters) {
            article.setAttribute("data-param-"+key, parameters[key]);
        }

        // Add the tag for the preview image
        if (!noPreview && previewImagePath != null && parseFloat(html5CodebaseVersion)>=4.4 && parameters.width != undefined) {
            var previewContainer = createScreenShotDiv(oriWidth, oriHeight, parameters.borderColor);
            article.appendChild(previewContainer);

            // This div is needed to have an element with position relative as origin for the absolute positioned image
            var previewPositioner = document.createElement("div");
            previewPositioner.style.position = "relative";
            previewPositioner.style.display = 'block';
            previewPositioner.style.width = oriWidth+'px';
            previewPositioner.style.height = oriHeight+'px';
            previewPositioner.appendChild(article);
            appletElem.appendChild(previewPositioner);
        } else {
            appletElem.appendChild(article);
        }

        // Load the web script
        if (loadScript) {
            if (parseFloat(html5CodebaseVersion)>=4.4) {

                if (fonts_css_url == null) {
                    var f_c_u = html5Codebase+"css/fonts.css";
                } else {
                    var f_c_u = fonts_css_url;
                }

                var fontscript1 = document.createElement("script");
                fontscript1.type = 'text/javascript';
                fontscript1.innerHTML = '\n' +
                    '//<![CDATA[\n' +
                    'WebFontConfig = {\n' +
                    '   loading: function() {},\n' +
                    '   active: function() {},\n' +
                    '   inactive: function() {},\n' +
                    '   fontloading: function(familyName, fvd) {},\n' +
                    '   fontactive: function(familyName, fvd) {},\n' +
                    '   fontinactive: function(familyName, fvd) {},\n' +
                    '   custom: {\n' +
                    '       families: ["geogebra-sans-serif", "geogebra-serif"],\n' +
                    '           urls: [ "'+f_c_u+'" ]\n' +
                    '   }\n' +
                    '};\n' +
                    '//]]>\n' +
                    '\n';

                var fontscript2 = document.createElement("script");
                fontscript2.type = 'text/javascript';
                fontscript2.src = html5Codebase+'/js/webfont.js';

                appletElem.appendChild(fontscript1);
                appletElem.appendChild(fontscript2);
            }

            // Remove all table tags within an article tag if there are any
            for (var i=0; i<article.childNodes.length;i++) {
                var tag = article.childNodes[i].tagName;
                if (tag == "TABLE") {
                    article.removeChild(article.childNodes[i]);
                    i--;
                }
            }

            // Remove old script tags
            if (ggbHTML5LoadedScript != null) {
                var el = document.querySelector('script[src="'+ggbHTML5LoadedScript+'"]');
                if (el != undefined) {
                    el.parentNode.removeChild(el);
                }
            }

            var script = document.createElement("script");

            var scriptLoaded = function() {
//                log("GeoGebra Web Script loaded. Src = "+script.src);
                ggbHTML5ScriptLoadInProgress = false;
                ggbHTML5ScriptLoadFinished = true;
            }

            script.src=html5Codebase + html5CodebaseScript;
            script.onload = scriptLoaded;
            ggbHTML5ScriptLoadInProgress = true;
            ggbHTML5ScriptLoadFinished = false;
            ggbHTML5LoadedCodebaseIsWebSimple = html5CodebaseIsWebSimple;
            ggbHTML5LoadedCodebaseVersion = html5CodebaseVersion;
            ggbHTML5LoadedScript = script.src;

            log("GeoGebra HTML5 applet injected. Codebase = '"+html5Codebase+"'.");
            appletElem.appendChild(script);
        } else if (renderWithoutReload) {
            renderGGBElement(article);
            log("GeoGebra HTML5 applet injected and rendered with previously loaded codebase.")
        } else {
            log("GeoGebra HTML5 applet injected without reloading web codebase.");
        }

        parameters.height = oriHeight;
        parameters.width = oriWidth;
    };

    var injectCompiledApplet = function(appletElem, parameters, noPreview) {

        var viewContainer = document.createElement("div");
        viewContainer.id = "view-container";
        viewContainer.style.width = (parameters.width-2)+'px';
        viewContainer.style.height = (parameters.height-2)+'px';
        viewContainer.style.border = "1px solid black";

        var viewImages = document.createElement("div");
        viewImages.id = '__ggb__images';

        // Add the tag for the preview image
        if (!noPreview && previewImagePath != null && parseFloat(html5CodebaseVersion)>=4.4 && parameters.width != undefined) {
            var previewContainer = createScreenShotDiv(parameters.width, parameters.height, parameters.borderColor);

            // This div is needed to have an element with position relative as origin for the absolute positioned image
            var previewPositioner = document.createElement("div");
            previewPositioner.style.position = "relative";
            previewPositioner.className = "ggb_preview_container";
            previewPositioner.style.display = 'block';
            previewPositioner.style.width = parameters.width+'px';
            previewPositioner.style.height = parameters.height+'px';
            previewPositioner.appendChild(previewContainer);
            appletElem.appendChild(previewPositioner);
        }

        // Load the applet script
        var appletStyle = document.createElement("style")
        appletStyle.innerHTML = '\n' +
            '.view-frame {\n' +
            '    border: 1px solid black;\n' +
            '    display: inline-block;\n' +
            '}\n' +
            '#tip {\n' +
            '    background-color: yellow;\n' +
            '    border: 1px solid blue;\n' +
            '    position: absolute;\n' +
            '    left: -200px;\n' +
            '    top: 100px;\n' +
            '};\n';

        appletElem.appendChild(appletStyle);

        var script = document.createElement("script");

        var scriptLoaded = function() {
            ggbHTML5ScriptLoadInProgress = false;
            ggbHTML5ScriptLoadFinished = true;
            appletElem.querySelector(".ggb_preview_container").remove();
            appletElem.appendChild(viewContainer);
            appletElem.appendChild(viewImages);
            window.onload();
        }

        var scriptFile = preCompiledScriptPath + "/applet.js";
        script.src=scriptFile;
        script.onload = scriptLoaded;
        ggbHTML5ScriptLoadInProgress = true;
        ggbHTML5ScriptLoadFinished = false;
        ggbHTML5LoadedScript = scriptFile;

        log("GeoGebra precompiled applet injected. Script="+scriptFile+".");
        appletElem.appendChild(script);
    };

    var injectScreenshot = function(appletElem, parameters) {

        // Add the tag for the preview image
        if (previewImagePath != null && parseFloat(html5CodebaseVersion)>=4.4 && parameters.width != undefined) {
            var previewContainer = createScreenShotDiv(parameters.width, parameters.height, parameters.borderColor);

            // This div is needed to have an element with position relative as origin for the absolute positioned image
            var previewPositioner = document.createElement("div");
            previewPositioner.style.position = "relative";
            previewPositioner.style.display = 'block';
            previewPositioner.style.width = parameters.width+'px';
            previewPositioner.style.height = parameters.height+'px';
            previewPositioner.className = "applet_screenshot";
            previewPositioner.appendChild(previewContainer);
            appletElem.appendChild(previewPositioner);
        }
    };

    var createScreenShotDiv = function(oriWidth, oriHeight, borderColor) {
        var previewContainer = document.createElement("div");
        previewContainer.className = "ggb_preview";
        previewContainer.style.position = "absolute";
        previewContainer.style.zIndex = "1000"
        previewContainer.style.width = oriWidth-2+'px'; // Remove 2 pixel for the border
        previewContainer.style.height = oriHeight-2+'px'; // Remove 2 pixel for the border
        previewContainer.style.top = "0px";
        previewContainer.style.left = "0px";
        previewContainer.style.overflow = "hidden";
        previewContainer.style.backgroundColor = "white";
        var borderColor = 'black';
        if (borderColor != undefined) {
            if (borderColor == "none") {
                borderColor = "transparent";
            }
        }
        previewContainer.style.border = "1px solid "+borderColor;

        var preview = document.createElement("img");
        preview.style.position = "relative";
        preview.style.zIndex = "1000";
        preview.style.top = "-1px"; // Move up/left to hide the border on the image
        preview.style.left = "-1px";
        preview.setAttribute("src", previewImagePath);
        preview.style.opacity = 0.3;

        if (previewLoadingPath != null) {
            var previewLoading = document.createElement("img");
            previewLoading.style.position = "absolute";
            previewLoading.style.zIndex = "1001";
            previewLoading.style.opacity = 1.0;
            previewLoading.setAttribute("src", previewLoadingPath);
            var pWidth = 360;
            if (pWidth > (oriWidth/4*3)) {
                var pWidth = oriWidth/4*3;
            }
            var pHeight = pWidth/5.8;
            var pX = (oriWidth - pWidth) / 2;
            var pY = (oriHeight - pHeight) / 2;
            previewLoading.style.left = pX + "px";
            previewLoading.style.top = pY + "px";
            previewLoading.setAttribute("width", pWidth-4);
            previewLoading.setAttribute("height", pHeight-4);
            previewContainer.appendChild(previewLoading);
        }

        previewContainer.appendChild(preview);
        return previewContainer;
    };


    var buildJNLPFileName = function(isOffline) {
        var version = parseFloat(javaCodebaseVersion);
        var filename = "applet" + version*10 + "_";
        if (isOffline) {
            filename += "local";
        } else {
            filename += "web";
        }
        if (views.is3D) {
            filename += "_3D";
        }
        filename += ".jnlp";
        return filename;
    };


    /**
     * Detects the type of the applet (java or html5).
     * If a fixed type is passed in preferredType (java or html5), this type is forced.
     * Otherwise the method tries to find out which types are supported by the system.
     * If a preferredType is passed, this type is used if it is supported.
     * If auto is passed, the preferred type is html5 for versions >= 4.4 and java for all versions < 4.4.
     * @param preferredType can be 'preferJava', 'preferHTML5', 'java', 'html5', 'auto' or 'screenshot'. Default='auto'
     */
    var detectAppletType = function(preferredType) {
        preferredType = preferredType.toLowerCase();
        if ((preferredType === "java") || (preferredType === "html5") || (preferredType === "screenshot") || (preferredType === "compiled")) {
            return preferredType;
        }

        if (preferredType === "preferjava") {
            if (applet.isJavaInstalled()) {
                return "java";
            } else {
                return "html5";
            }
        } else if (preferredType === "preferhtml5") {
            if (applet.isHTML5Installed()) {
                return "html5";
            } else {
                return "java";
            }
        } else if ((preferredType === "prefercompiled") && (preCompiledScriptPath != null)) {
            return "compiled";
        } else {
            // type=auto
            if ((applet.isJavaInstalled()) &&
                (!applet.isHTML5Installed() || views.PC || views.is3D)) {
                return "java";
            } else {
                return "html5";
            }
        }
    };

    var getIEVersion = function() {
        a=navigator.appVersion;
        return a.indexOf('MSIE')+1?parseFloat(a.split('MSIE')[1]):999
    };


    /**
     * @param version Can be: 3.2, 4.0, 4.2, 4.4, 5.0, test, test42, test44, test50
     */
    var setDefaultHTML5CodebaseForVersion = function(version) {

        // Set the correct codebase version for the passed version
        if (version == "test") {
            if (parseFloat(ggbVersion) < 4.4)
                version = "4.4";
            else
                version = ggbVersion;
            html5CodebaseVersion += version.substr(0,1) + version.substr(2,1);
        } else
            html5CodebaseVersion = version;
        if (version.substr(0,4) != "test") {
            if (parseFloat(html5CodebaseVersion)<4.4) // For versions below 4.4 the HTML5 codebase of version 4.4 is used.
                html5CodebaseVersion = "4.4";
            else if (parseFloat(version) >= 5.0)
                html5CodebaseVersion = "test50";
            else if (version == "test44")
                html5CodebaseVersion = "4.4"; // there is no 4.4 test version
        }

        // Set the codebase URL for the version
        if (html5CodebaseVersion == "4.2") {
            codebase = "http://js.geogebra.at/";
            var hasWebSimple = false;
        } else {
            var hasWebSimple = ! html5NoWebSimple;
            if (window.location.protocol.substr(0,4) == 'http')
                var protocol = window.location.protocol;
            else
                var protocol = 'http:';
            var codebase = protocol+"//www.geogebra.org/web/" + html5CodebaseVersion + "/";
        }

        // Decide if web or websimple should be used
        if (hasWebSimple && !views.is3D && !views.AV && !views.SV && !views.CV && !views.EV2 && !views.CP && !views.PC && !views.DA && !views.FI && !views.PV
            && !parameters.showToolBar && !parameters.showMenuBar && !parameters.showAlgebraInput && !parameters.enableRightClick) {
            codebase += 'webSimple/';
        } else {
            codebase += 'web/';
        }

        applet.setHTML5Codebase(codebase, false);
    };

    var setDefaultJavaCodebaseForVersion = function(version) {

        // There are no test versions for java. So when test is passed, it will be converted to the normal codebase
        if (version == "test32")
            javaCodebaseVersion = "3.2";
        else if (version == "test40")
            javaCodebaseVersion = "4.0";
        else if (version == "test42")
            javaCodebaseVersion = "4.2";
        else if (version == "test50")
            javaCodebaseVersion = "5.0";
        else if (version == "test")
            javaCodebaseVersion = ggbVersion;
        else
            javaCodebaseVersion = version;

        // For versions below 4.0 the java codebase of version 4.0 is used.
        if (parseFloat(javaCodebaseVersion)<4.0)
            javaCodebaseVersion = "4.0";

        if (window.location.protocol.substr(0,4) == 'http')
            var protocol = window.location.protocol;
        else
            var protocol = 'http:';
        var codebase = protocol+"//jars.geogebra.org/webstart/" + javaCodebaseVersion + '/';
        if (javaCodebaseVersion == '4.0' || javaCodebaseVersion == '4.2')
            codebase += 'jnlp/';

        applet.setJNLPBaseDir('http://www.geogebratube.org/webstart/');

        doSetJavaCodebase(codebase, false);
    };

    var log = function(text) {
        if ( window.console && window.console.log ) {
            console.log(text);
        }
    };

    // Read the material parameters from the tube API, if a material_id was passed
    if (parameters.material_id != undefined) {
        fetchParametersFromTube(continueInit);
    } else {
        continueInit();
    }

    function continueInit() {

        // Initialize the codebase with the default URLs
        setDefaultHTML5CodebaseForVersion(ggbVersion);
        setDefaultJavaCodebaseForVersion(ggbVersion);
        initComplete = true;
    }

    return applet;
};


function iframeAppletByName(name) {
    if (eval("typeof(window.frames." + name + ".document)") != 'undefined')
        return eval("window.frames." + name + ".document.ggbApplet");
    return eval("window.frames." + name + ".contentDocument.ggbApplet");
}
