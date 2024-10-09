// ---------------- gestione parametri/status variables
var m_LogicLabTypes = app.CallFunction("script.GetLogicLabTypes")
var TYPEPAR = m_LogicLabTypes.TYPEPAR
var GetNodeText = genfuncs.GetNodeText

var INDEX_CANOPEN_NONE = 0
var m_CANOpen_IndexRange	= { start:  0x3000,	end:  0xFFFF,	definit:	0x3000	}	//	0x3000	to	0xFFFF
var m_CANOpen_SubindexRange	= { start:  0,		end:  127	}	//	0x00	to	0x7F

var PATH_OBJECT_DICTIONARY = "config[1]/CANopenObjDict[1]/objdict"
