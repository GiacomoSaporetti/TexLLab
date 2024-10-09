var HTMLCTRL = app.CallFunction("WebServer.GetHTMLControls");
var WEBITEMTYPES = app.CallFunction("WebServer.GetWebItemTypes");
var m_allowedItemTypes = app.CallFunction("WebServer.GetAllowedItemTypes");
var m_customFormatReverseFunc = app.CallFunction("WebServer.GetCustomFormatReverseFunc");
var m_targetID = app.CallFunction("logiclab.get_TargetID");
var m_globalVarsMap = {};
var m_globalVarsList = [];

function VarObj(name, type, descr, ro, format)
{
	this.name = name;
	this.Type = type;
	this.description = descr;
	this.readOnly = ro;
	this.format = (format !== undefined ? format : "");
}

function AddVarsList(varList)
{
	for (var i = 0, t = varList.length; i < t; i++)
	{
		var v = varList.item(i);
		// crea oggetto temporaneo per evitare di tenere in giro riferimenti alla PlcVar originale
		var varObj = new VarObj(v.Name, v.Type, v.Description, false, "");
		m_globalVarsMap[varObj.name] = varObj;
		m_globalVarsList.push(varObj);
	}
}

function LoadVarsList()
{
	// genera mappa e lista con tutte le var PLC
	if (m_allowedItemTypes & WEBITEMTYPES.PLC)
	{
		var varList = app.CallFunction("logiclab.GetProjectVariables");
		AddVarsList(varList);

		//var varList = app.CallFunction("logiclab.GetAuxSrcVariables", "");
		//AddVarsList(varList);
	}

	// supporto parametri locali
	if (m_allowedItemTypes & WEBITEMTYPES.PAR)
	{
		var paramMap = app.CallFunction(m_targetID + ".GetParamMap");
		for (var parName in paramMap)
		{
			var par = paramMap[parName];
			var typeIEC = app.CallFunction(m_targetID + ".TypeParToIEC", par.typePar, par.typeTarg);
			
			// NB: il campo readonly è stringa...
			var varObj = new VarObj(par.name, typeIEC, par.description, genfuncs.ParseBoolean(par.readonly), par.format);
			m_globalVarsMap[varObj.name] = varObj;
			m_globalVarsList.push(varObj);
		}
	}
	
	// supporto parametri remoti tramite PARX
	if (m_allowedItemTypes & WEBITEMTYPES.REMOTEPAR)
	{
		var CFGTYPES = app.CallFunction("configurator.GetGeneralTypes");
		var externalSlavesMap = app.CallFunction(m_targetID + ".GetExternalSlavesMap");
		for (var id in externalSlavesMap)
		{
			var externalSlave = externalSlavesMap[id];
			
			for (var i = 0, t = externalSlave.parList.length; i < t; i++)
			{
				var par = externalSlave.parList[i];
				var fullname = "@" + externalSlave.deviceID + "." + par.name;
				
				// se enum, verifica che l'enum sia effettivamente presente tra quelli del parx (potrebbe non esserci in caso di formato parx vecchio!)
				if (par.typePar == CFGTYPES.parTypes.Enum && !(par.enumId in externalSlave.enums))
					var typeIEC = CFGTYPES.typeNamesIEC[par.typeTarg];
				else
					var typeIEC = CFGTYPES.typeNamesIEC[par.typePar];
					
				var varObj = new VarObj(fullname, typeIEC, par.description, par.readOnly, par.format);
				m_globalVarsMap[varObj.name] = varObj;
				m_globalVarsList.push(varObj);
			}
		}
	}
}

function Assign()
{
	if (grid.NumRows == 0)
		return false
	
	var row = grid.SelectedRow

	app.TempVar("VarsList_input") = m_globalVarsList
	app.TempVar("varsList_multipleSel") = false;
	app.OpenWindow("PLCVarsList", app.Translate("Choose PLC variable"), "")
	app.TempVar("VarsList_input") = undefined

	var result = app.TempVar("VarsList_result")
	if (!result || result.length == 0)
		return false
	
	var item = m_globalVarsList[result[0]]
	if (!item)
		return false
	
	// setta i valori della riga
	grid.Elem(row, columns.name) = item.name
	if (columns.readOnly)
		grid.Elem(row, columns.readOnly) = item.readOnly ? 1 : 0;
	
	if (columns.format && item.format)
	{
		var format = m_customFormatReverseFunc ? m_customFormatReverseFunc(item.format) : item.format;
		grid.Elem(row, columns.format) = format;
	}

	grid.Update(row, -1)
	return true
}
