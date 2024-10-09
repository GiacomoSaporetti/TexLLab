// AGGIORNAMENTO FILES PCT CREATI CON MODBUSCUSTOMEDITOR
// questo script è invocato dal setup

var m_fso = new ActiveXObject("Scripting.FileSystemObject")


function UpgradePCT(filepath)
{
	var doSave = false
	var xmldoc = new ActiveXObject("MSXML2.DOMDocument.6.0")
	xmldoc.async = false
	if (!xmldoc.load(filepath))
		return
	
	var version = xmldoc.selectSingleNode("/devicetemplate/networkconfig/datadef/@version")
	if (!version)
		return
	
	if (version.text < 2.0)
	{
		// crea ModbusCustom_config/turnAround   (default 0)
		var parent = xmldoc.selectSingleNode("/devicetemplate/networkconfig/templatedata/PREFIX/ModbusCustom_config")
		if (parent)
			parent.appendChild(xmldoc.createElement("turnAround")).text = 0
			
		version.text = "2.0"
		doSave = true
	}
	
	if (doSave)
		try
		{
			xmldoc.save(filepath)
		}
		catch (ex)
		{ }
}


// --------------------------------------- MAIN ------------------------------
var path = WScript.Arguments(0) + "\\Catalog\\ModbusCustom"
var folder = m_fso.GetFolder(path)
	
// iterazione su tutti i files *.PCT
for (var en = new Enumerator(folder.files); !en.atEnd(); en.moveNext())
{
	var filepath = en.item().Path
	if (m_fso.GetExtensionName(filepath).toLowerCase() == "pct")
		UpgradePCT(filepath)
}
