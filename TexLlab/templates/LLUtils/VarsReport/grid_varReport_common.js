
var m_LogicLabTypes = app.CallFunction("script.GetLogicLabTypes")
var TYPEPAR = m_LogicLabTypes.TYPEPAR
var TYPEPAR_DESCR = m_LogicLabTypes.TYPEPAR_DESCR
var ENUM_BASE = m_LogicLabTypes.ENUM_BASE
var m_typeTargs = m_LogicLabTypes.TYPETARG
var m_enums = {}

// crea gli enumerativi per i tipi
function CreateEnums()
{
	m_enums["BOOL"] = {0 : "False", 1 : "True"};
	
	// ottiene tutto l'elenco degli enum del progetto PLC
	var enumsSafearr = app.CallFunction("logiclab.QueryPrjSymbols", m_LogicLabTypes.PLCOBJ_TYPES.PLCOBJ_ENUM, m_LogicLabTypes.SYMLOC.symlProject, "", "");
	var enumsList = genfuncs.FromSafeArray(enumsSafearr);
	
	for (var i = 0; i < enumsList.length; i++)
	{
		var enumName = enumsList[i];
		var newEnum = {};
		var enumElements = app.CallFunction("logiclab.GetEnumElements", enumName);
		for (var el = 0; el < enumElements.Length; el++)
		{
			var enumElement = enumElements.Item(el);
			newEnum[enumElement.InitValue] = enumElement.Name;
		}
		
		m_enums[enumName] = newEnum;
	}
}

