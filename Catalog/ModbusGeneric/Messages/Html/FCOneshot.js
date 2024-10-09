var m_useAlModbusStructSlaves;

function Modify_OnKeyDown( ctrlId )
{
	if (event.keyCode == 13)
	     ctrlId.blur();
}
	
function Modify( ctrlId )
{
	var typeFilter = 'BOOL'
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, typeFilter )

	var prevLabel = app.DataGet(m_dataPath + FIELD_ONESHOT, 0)
			
	if ( prevLabel == ctrlId.value )
		return
	
	if ( ctrlId.value == "" )
	{
		UnAssign( ctrlId )
	}
	else
	{
		var item
		if ( m_useAlModbusRTU )
			item = ModifyPLCVarAssigment_raw(ctrlId.value, typeFilter, PLCVARTYPES_FIXED, dataBlock, prevLabel, undefined, "Modbus_Vars")
		else
			item = ModifyPLCVarAssigment_raw(ctrlId.value, typeFilter, PLCVARTYPES_FIXED, dataBlock, prevLabel)

		if ( item )
		{
				ctrlId.value = item.name
				app.DataSet( m_dataPath + FIELD_ONESHOT, 0, item.name )
		}
        else
			ctrlId.value = prevLabel
	}
}
	
function Assign( ctrlId )
{
	var typeFilter = 'BOOL'
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", m_protocol, false, typeFilter )
		
	var item = AssignPLCVar_raw( typeFilter, dataBlock, ctrlId.value )
	if ( item )
	{
			ctrlId.value = item.name
			app.DataSet( m_dataPath + FIELD_ONESHOT, 0, item.name )
	}
}
	
function UnAssign( ctrlId )
{
	var prevLabel = app.DataGet(m_dataPath + FIELD_ONESHOT, 0)
	app.CallFunction("script.UnassignPLCVar", prevLabel )
		
	app.DataSet( m_dataPath + FIELD_ONESHOT, 0, "" )
	ctrlId.value = ""
}

function HideCtrlById(name)
{
	var ctrl = document.getElementById(name);
	if (ctrl)
		ctrl.style.display = "none";
}

function DetectFeatures(node)
{
	var protocol = node.parentNode.parentNode.getAttribute("protocol")
	var device  = node.selectSingleNode(XPATH_ROOTDEVICE)

	m_useAlModbusRTU = genfuncs.ParseBoolean(device.getAttribute("useAlModbusRTU"));
	if (m_useAlModbusRTU)
	{
		if ( protocol == "ModbusTCP_master" )
			m_oneShotEnabled = genfuncs.ParseBoolean(device.getAttribute("useAlModbusTCPOneShot"));
		else
			m_oneShotEnabled = genfuncs.ParseBoolean(device.getAttribute("useAlModbusRTUOneShot"));
	}
	else
		m_oneShotEnabled = true;  // per LLExec sempre attivo
	
	m_useAlModbusStructSlaves = genfuncs.ParseBoolean(device.getAttribute("useAlModbusStructSlaves"));
	if (m_useAlModbusStructSlaves)
	{
		HideCtrlById("butAssignIn");
		HideCtrlById("butUnAssignIn");
		HideCtrlById("butAssignOut");
		HideCtrlById("butUnAssignOut");
	}
	
	var hasWaitBeforeSend;
	if (protocol == "ModbusTCP_master")
		hasWaitBeforeSend = false;    // non esiste mai su TCP
	else
		hasWaitBeforeSend = !m_useAlModbusRTU || (device.getAttribute("useAlModbusRTUWaitBeforeSend") == "true");  // c'è su LLExec o AlModbusRTU solo più nuovi
	
	rowTurnAround.style.display = hasWaitBeforeSend ? "" : "none";
	
	rowOneShot.style.display = m_oneShotEnabled ? "" : "none";
}
