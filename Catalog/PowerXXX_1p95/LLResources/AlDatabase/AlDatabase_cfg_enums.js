
function ResetEnumType( paramNode )
{
	var logicLabTypes = app.CallFunction("script.GetLogicLabTypes")
	var TYPEPAR = m_LogicLabTypes.TYPEPAR
	
	//	change type
	genfuncs.SetNode( paramNode, "typetarg", "DINT" )
	//	change type
	genfuncs.SetNode( paramNode, "typepar", TYPEPAR["DINT"] )
}

function GetEnumVariableName( enum_caption )
{
	return enum_caption
}

function GetEnumNode( enum_name )
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var deviceNode = app.SelectNodesXML( "/" + targetID )[0]
	var node = deviceNode.selectSingleNode( PATH_ENUMS + "[@caption = '" + enum_name + "'] | " + PATH_SYSENUMS + "[@caption = '" + enum_name + "']" )
	if ( node )
		return node
	else 
		return undefined
}

function ValidateEnums(device)
{
	var nodes = device.selectNodes( PATH_SYSENUMS + " | " + PATH_ENUMS )
	var node
	
	var enumsMap = {}
	
	while ( node = nodes.nextNode() )
	{
		var caption = node.getAttribute( "caption" )
		
		//	valid name
		if ( !app.CallFunction( "compiler.isValidVarName", caption ) )
		{
			var err = app.CallFunction("common.SplitFieldPath", node)
			var msg = app.Translate( "Invalid enumerative definition name specified: %1" ).replace( "%1", caption )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "ValidateEnums", msg, err)
		}
		
		//	check duplication
		if ( enumsMap[ caption ] )
		{
			var err = app.CallFunction("common.SplitFieldPath", node)
			var msg = app.Translate( "Enumerative definition name duplicated: %1" ).replace( "%1", caption )
			return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "ValidateEnums", msg, err)
		}
		else
		{
			enumsMap[ caption ] = true
		}

		var enumValueNodes = node.selectNodes( "enum_value" )
		var enumValueNode
		var enumValuesValuesMap = {}
		var enumValuesDescriptionMap = {}
		
		//	check value duplication
		while ( enumValueNode = enumValueNodes.nextNode() )
		{
			var value = parseInt( genfuncs.GetNode( enumValueNode, "value" ) )
			
			if ( enumValuesValuesMap[ value ] )
			{
				var err = app.CallFunction("common.SplitFieldPath", enumValueNode.selectSingleNode( "value" ) )
				var msg = app.Translate( "Enumerative value duplicated for enum '%1': %2" ).replace( "%1", caption ).replace( "%2", value )
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "ValidateEnums", msg, err)
			}
			else
			{
				enumValuesValuesMap[ value ] = true
			}
		}
		
		//	check description duplication		
		enumValueNodes.reset()
		
		while ( enumValueNode = enumValueNodes.nextNode() )
		{
			var name = genfuncs.GetNode( enumValueNode, "name" )
			
			if ( name == "" )
			{
				var err = app.CallFunction("common.SplitFieldPath", enumValueNode.selectSingleNode( "name" ) )
				var msg = app.Translate( "Enumerative name is empty for enum '%1'" ).replace( "%1", caption )
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "ValidateEnums", msg, err)
			}
			
			if ( enumValuesDescriptionMap[ name ] )
			{
				var err = app.CallFunction("common.SplitFieldPath", enumValueNode.selectSingleNode( "name" ) )
				var msg = app.Translate( "Enumerative name duplicated for enum '%1': %2" ).replace( "%1", caption ).replace( "%2", name )
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "ValidateEnums", msg, err)
			}
			else
			{
				enumValuesDescriptionMap[ name ] = true
			}
			
			if ( !app.CallFunction( "compiler.isValidVarName", name ) )
			{				
				var err = app.CallFunction("common.SplitFieldPath", enumValueNode.selectSingleNode( "name" ) )
				var msg = app.Translate( "Invalid name specified for enum '%1': %2" ).replace( "%1", caption ).replace( "%2", name )
				return app.CallFunction("common.AddLog", enuLogLevels.LEV_CRITICAL, "ValidateEnums", msg, err)
			}
		}
		
	}
	
	return enuLogLevels.LEV_OK
}

function GenerateEnums(root)
{
	var content = ""

	var enumNodes = root.selectNodes( PATH_SYSENUMS + " | " + PATH_ENUMS )
	
	if ( enumNodes.length == 0 )
		return content
	
	content += "TYPE\n\n"
	
	var enumNode
	while ( enumNode = enumNodes.nextNode() )
	{
		var enumValueNodes = enumNode.selectNodes( "enum_value" )
		
		//	no values specified for current enum
		if ( enumValueNodes.length == 0 )
			continue
				
		var name = enumNode.getAttribute( "caption" )
		var enumStr = ""
		
		var enumName = GetEnumVariableName( name )
		enumStr += "\t" + enumName + " : (\n"
		
		var enumValueNode
		var i = 0
		while ( enumValueNode = enumValueNodes.nextNode() )
		{
			var value = parseInt( genfuncs.GetNode( enumValueNode, "value" ) )
			var name = genfuncs.GetNode( enumValueNode, "name" )
			var description = genfuncs.GetNode( enumValueNode, "description" )
			var helpText = genfuncs.GetNode( enumValueNode, "helpText" )
			
			enumStr += "\t\t" + name + " := " + value
			//enumStr += "\t\t" + enumName + "_" + name + " := " + value
			
			if ( i < enumValueNodes.length - 1 )
				enumStr += ","
			if ( helpText != "" )
				enumStr += '\t{ DE:"' + helpText + '" }'
			else if ( description != "" )
				enumStr += '\t{ DE:"' + description + '" }'
			enumStr += "\n"
			i++
		}
		
		enumStr += "\t);\n\n"
		
		content += enumStr
	}
	
	content += "END_TYPE\n\n"
	
	return content
}
