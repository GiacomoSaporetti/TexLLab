var xmldoc = new ActiveXObject("Msxml2.DOMDocument.6.0")
xmldoc.async = false
xmldoc.validateOnParse = false

var filename = WScript.Arguments(0)

xmldoc.load(filename)

var schemacache = new ActiveXObject("Msxml2.XMLSchemaCache.6.0")
xmldoc.schemas = schemacache

var xsddoc = new ActiveXObject("Msxml2.DOMDocument.6.0")
xsddoc.async = false

xsddoc.load("AlFramework.xsd")
schemacache.add("", xsddoc)

xsddoc.load("Configurator.xsd")
schemacache.add("", xsddoc)

xsddoc.load("PCT.xsd")
schemacache.add("", xsddoc)

var result = xmldoc.validate()
if (result.errorCode != 0)
{
	WScript.Echo(filename)
	WScript.Echo(result.reason)
//	WScript.Echo(result.line + "," + result.linepos + " : " + result.srcText)
}