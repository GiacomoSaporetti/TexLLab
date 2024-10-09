var m_useAlModbusRTU = false

function Modify_OnKeyDown( ctrlId )
{
	if (event.keyCode == 13)
	     ctrlId.blur();
}
	
function Modify( ctrlId )
{
	var typeFilter = 'BOOL'
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "ModbusRTU_master", false, typeFilter )

	var prevLabel = app.DataGet(m_dataPath + FIELD_ONESHOT, 0)
			
	if ( prevLabel == ctrlId.value )
		return
		
	if ( ctrlId.value == "" )
	{
		UnAssign( ctrlId )
	}
	else
	{
		var item = ModifyPLCVarAssigment_raw(ctrlId.value, typeFilter, PLCVARTYPES_FIXED, dataBlock, prevLabel)
			
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
	var dataBlock = app.CallFunction(m_extName + ".GetIODataBlockName", "ModbusRTU_master", false, typeFilter )
		
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
	var device  = node.selectSingleNode(XPATH_ROOTDEVICE)
	
	m_useAlModbusRTU = genfuncs.ParseBoolean(device.getAttribute("useAlModbusRTU"));
	
	rowOneShot.style.display = m_useAlModbusRTU ? "none" : ""
	
	m_useAlModbusStructSlaves = genfuncs.ParseBoolean(device.getAttribute("useAlModbusStructSlaves"));
	if (m_useAlModbusStructSlaves)
	{
		HideCtrlById("butAssignOut");
		HideCtrlById("butUnAssignOut");
	}
}
