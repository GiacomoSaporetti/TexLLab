// --------------------------Machine configuration-------------------------------------->

var GetNode = genfuncs.GetNode
var GetNodeText = genfuncs.GetNodeText
	
function MachineParameter()
{
	this.pageNumber = "";
	this.uniqueID = null;
	this.value = "";
	this.descr = "";
	this.enumValues = [];
	this.visible = false;
}

function MachineConfiguration()
{
	this.name = ""
	this.version = ""
	this.parameters = {}	// mappa nome sezione parametri -> lista parametri
	this.installedAxis = {}
}

var TREENAME = "tree1";

function LoadMachineConfiguration(str)
{
	var machineConfig = new MachineConfiguration();
	if(!machineConfig.Parse(str))
		return;
	
	// caricamento nel pcn del progetto
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0];
	var machineConfigurationNode = device.selectSingleNode("machineConfiguration");
	
	var childNode = machineConfigurationNode.firstChild;
	while (childNode)
	{
		var nextNode = childNode.nextSibling;
		app.DataDelete(app.GetDataPathFromNode(childNode), 0);
		childNode = nextNode;
	}
	
	machineConfigurationNode.setAttribute("name", machineConfig.name);
	machineConfigurationNode.setAttribute("version", machineConfig.version);
	
	var sectionToDataPath = {}
	for (var section in machineConfig.parameters)
	{
		var destPath = app.AddTemplateData("machineParameters", app.GetDataPathFromNode(machineConfigurationNode), 0, false);
		var destNode = app.SelectNodesXML(destPath)[0];
		destNode.setAttribute("caption", section);
		
		sectionToDataPath[section] = destPath;
		
		app.HMISetCaption(TREENAME, app.HMIGetElementPath(TREENAME, destPath), section);
		
		LoadParameters(destPath, machineConfig.parameters[section], machineConfig.installedAxis);
	}
	
	for (var section in sectionToDataPath)
	{
		var axisName = section.slice(-2);
		// per sicurezza controllo che ci sia lo spazio, la sezione si deve chiamare es. "Parametri speciali asse X"
		if(axisName[0] == " " && machineConfig.installedAxis[axisName[1]])
			app.DataSet(sectionToDataPath[section] + "/@enabled", 0, 1);
		// prime due sezioni sempre abilitate
		else if(app.CallFunction("common.StringEndsWith", sectionToDataPath[section], "[1]") || app.CallFunction("common.StringEndsWith", sectionToDataPath[section], "[2]"))
			app.DataSet(sectionToDataPath[section] + "/@enabled", 0, 1);
	}
}

function LoadParameters(path, paramsList, installedAxis)
{
	for (var i = 0; i < paramsList.length; i++)
	{
		var param = paramsList[i]
		var destPath = app.AddTemplateData("machineParameter", path, 0, false);
		app.DataSet(destPath + "/pageNumber", 0, param.pageNumber);
		app.DataSet(destPath + "/uniqueID", 0, param.uniqueID);
		app.DataSet(destPath + "/value", 0, param.value);
		app.DataSet(destPath + "/descr", 0, param.descr);
		app.DataSet(destPath + "/visible", 0, param.visible);
		
		if(param.uniqueID == 0 && param.pageNumber == 0)
		{
			for (var z = 0; z < param.value.length; z++)
				installedAxis[param.value[z]] = true;
		}
		
		for (var z = 0; z < param.enumValues.length; z++)
		{
			var enumDestPath = app.AddTemplateData("enum_value", destPath + "/enumValues", 0, false);
			var enumVal = param.enumValues[z].split("=");
			app.DataSet(enumDestPath + "/value", 0, enumVal[0]);
			app.DataSet(enumDestPath + "/descr", 0, enumVal[1]);
		}
		
	}
}

MachineConfiguration.prototype.Parse = function (str)
{
	var rows = str.split(/\r?\n/);

	// almeno 2 righe
	if(rows.length < 2)
	{
		app.PrintMessage("!!! CRITICAL ERROR: incomplete or corrupted file")
		return false;
	}
	
	this.name = rows.shift().substring(1);
	this.version = rows.shift().substring(1);
	
	var currParametersSection = null
	for(var i = 0; i < rows.length; i++)
	{
		var row = rows[i];
		if(!row)
			continue;
		
		if(row[0] == ";")
		{
			var sectionName = row.substring(1);
			this.parameters[sectionName] = []
			currParametersSection = this.parameters[sectionName];
			
			continue;
		}
		
		// esempi parametri
		//0,181:0          ;codice applicativo cliente
		//0,231:1 ;slot 1                         :                  0=empty 1=16di 2=16do 3=8di8do
		
		var commaIndex = row.indexOf(",");
		var colomnIndex = row.indexOf(":");
		var semiColomnIndex = row.indexOf(";");
		if(commaIndex == -1 || colomnIndex == -1 || semiColomnIndex == -1)
			continue;
		
		var par = new MachineParameter();
		par.pageNumber = parseInt(row.slice(0, commaIndex));
		par.uniqueID = parseInt(row.slice(commaIndex + 1, colomnIndex));
		
		var valuesString = 	row.slice(colomnIndex + 1, semiColomnIndex);
		par.value = valuesString.replace(/\s/g, '');
		
		var enumValuesString
		var descriptionString = row.slice(semiColomnIndex + 1);
		var enumColomnsIndex = descriptionString.indexOf(":"); // test se enumerativo
		if(enumColomnsIndex != -1)
		{
			enumValuesString = descriptionString.slice(enumColomnsIndex + 1);
			enumValuesString = enumValuesString.replace(/^\s+/g, '')


			// troppo complesso da fare con una regular expression
			// tutti gli enumerativi sono interi quindi faccio il parsing con la stringa
			
			var index = enumValuesString.lastIndexOf("=")
			while(index != -1)
			{
				var enumVal = enumValuesString.slice(index - 1);
				enumVal = enumVal.replace(/\s+$/, '');
				par.enumValues.push(enumVal);
				
				enumValuesString = enumValuesString.slice(0, index - 1);
				
				index = enumValuesString.lastIndexOf("=")
			}			
			
			/*
			var tokens = enumValuesString.match(/([\S]+)=([\S]+)/g);
			if(tokens)
			{
				for(var z = 0; z < tokens.length; z++)
				{
					par.enumValues.push(tokens[z]);
				}
			}
			*/			
			
			descriptionString = descriptionString.slice(0, enumColomnsIndex);
		}
		
		par.descr = descriptionString.replace(/\s+$/, '');
		
		if(currParametersSection != null)
			currParametersSection.push(par);
	}
	
	return true;
}

function SaveMachineConfiguration(fileName)
{
	var result = []
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0];
	var machineConfigurationNode = device.selectSingleNode("machineConfiguration");
	result.push(";" + GetNode(machineConfigurationNode, "@name"));
	result.push(";" + GetNode(machineConfigurationNode, "@version"));
	result.push("")
	
	var nodelist = machineConfigurationNode.selectNodes("machineParameters/machineParameter");
	var node;
	var sectionNode = null
	
	while(node = nodelist.nextNode())
	{
		if(node.parentNode != sectionNode)
		{
			result.push("")
			sectionNode = node.parentNode;
			result.push(";" + GetNode(sectionNode, "@caption"))
			result.push("")
		}
		
		// esempi parametri
		//0,181:0          ;codice applicativo cliente
		//0,231:1 ;slot 1                         :                  0=empty 1=16di 2=16do 3=8di8do
		
		var par = genfuncs.FormatMsg("%1,%2:%3;%4", GetNodeText(node, "pageNumber"),GetNodeText(node, "uniqueID"),
					GetNodeText(node, "value"),GetNodeText(node, "descr"));
		
		var enumStr = ""
		var enumlist = node.selectNodes("enumValues/enum_value");
		var enumNode
		while(enumNode = enumlist.nextNode())
		{
			enumStr += GetNodeText(enumNode, "value") + "=" + GetNodeText(enumNode, "descr")
			enumStr += "	"
		}
		
		if(enumStr != "")
			par += "	:	" + enumStr;
		
		result.push(par)
	}
	
	try
	{
		var f = m_fso.CreateTextFile(fileName);
		f.Write(result.join("\r\n"));
		f.Close();
	}
	catch (e)
	{
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), fileName));
		return false;
	}
	
	return true
	
}


// <--------------------------Machine configuration-------------------------------------->

//------------------------@Giacomo Saporetti EDITOR ---------------------------------------




//Editor for various languages @Giacomo Saporetti
function AlertMessage()
{
	//this.languageID = null;
	this.msgID = null;
	this.message = "";
}

function LanguageMessage()
{
	this.parameters = {};
}
//

function LoadMessages(str)
{
	var langMessage = new LanguageMessage();
	if(!langMessage.Parse(str))
		return;

	// caricamento nel pcn del progetto
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0];
	var machineConfigurationNode = device.selectSingleNode("machineConfiguration");

	var childNode = machineConfigurationNode.firstChild;
	while (childNode)
	{
		var nextNode = childNode.nextSibling;
		app.DataDelete(app.GetDataPathFromNode(childNode), 0);
		childNode = nextNode;
	}

	var sectionToDataPath = {}
	for (var section in langMessage.parameters)
	{
		var destPath = app.AddTemplateData("machineParameters", app.GetDataPathFromNode(machineConfigurationNode), 0, false);
		var destNode = app.SelectNodesXML(destPath)[0];
		destNode.setAttribute("caption", section);
		
		sectionToDataPath[section] = destPath;
		app.HMISetCaption(TREENAME, app.HMIGetElementPath(TREENAME, destPath), section);

		LoadMSG(destPath, langMessage.parameters[section]);
	}

	for (var section in sectionToDataPath)
	{
		app.DataSet(sectionToDataPath[section] + "/@enabled", 0, 1);
	}
	
}

function LoadMSG(path, paramsList)
{
	for (var i = 0; i < paramsList.length; i++)
	{
		var param = paramsList[i]
		var destPath = app.AddTemplateData("machineParameter", path, 0, false);
		app.DataSet(destPath + "/uniqueID", 0, param.msgID);
		app.DataSet(destPath + "/descr", 0, param.message);
		
	}
}

LanguageMessage.prototype.Parse = function (str)
{
	
	var rows = str.split(/\r?\n/);

	// almeno 2 righe
	if(rows.length < 2)
	{
		app.PrintMessage("!!! CRITICAL ERROR: incomplete or corrupted file")
		return false;
	}
	

	var currParametersSection = null
	var passed_intro = false
	for(var i = 0; i < rows.length; i++)
	{
		
		var row = rows[i];
		if(!row)
			continue;

		if(!passed_intro)
		{	
			if(row[0] != '0')
				continue;
			passed_intro = true;
		}

		if(row[0] == ";")
		{
			if(row[1] != "=" && row[1] != "-")
			{
				var sectionName = row.substring(1).replace(/\s/g, '');
				this.parameters[sectionName] = [];
				currParametersSection = this.parameters[sectionName];
			}
			continue;
		}

		var equalIndex = row.indexOf("=");
		if(equalIndex == -1)
			continue;

		var par = new AlertMessage();
		//par.languageID = "0";
		par.msgID = parseInt(row.slice(0, equalIndex));
		par.message = row.slice(equalIndex + 1);
		
	
		if(currParametersSection != null)
			currParametersSection.push(par);
	}
	return true;
}



function SaveMessages(fileName)
{
	var result = []
	var device = app.SelectNodesXML("/" + app.CallFunction("logiclab.get_TargetID"))[0];
	var machineConfigurationNode = device.selectSingleNode("machineConfiguration");
	
	var nodelist = machineConfigurationNode.selectNodes("machineParameters/machineParameter");
	var node;
	var sectionNode = null
	
	while(node = nodelist.nextNode())
	{
		if(node.parentNode != sectionNode)
		{
			result.push("")
			sectionNode = node.parentNode;
			result.push(";" + GetNode(sectionNode, "@caption"))
			result.push("")
		}
		
		// esempi parametri
		//0,181:0          ;codice applicativo cliente
		//0,231:1 ;slot 1                         :                  0=empty 1=16di 2=16do 3=8di8do
		
		var par = genfuncs.FormatMsg("%1=%2", GetNodeText(node, "uniqueID"),GetNodeText(node, "descr"));
		
		
		result.push(par)
	}
	
	try
	{
		var f = m_fso.CreateTextFile(fileName);
		f.Write(result.join("\r\n"));
		f.Close();
	}
	catch (e)
	{
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("ERROR: Cannot write '%1' file"), fileName));
		return false;
	}
	
	return true
	
}