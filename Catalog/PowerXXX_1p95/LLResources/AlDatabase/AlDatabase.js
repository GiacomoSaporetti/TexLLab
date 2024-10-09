var TREE = "tree1"
var ENUM_DEFAULT_NAME_PREFIX = "Enum"
var gentypes = app.CallFunction("common.GetGeneralTypes")
var genfuncs = app.CallFunction("common.GetGeneralFunctions")

function GetEnumUniqueCaption(prefix)
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var enumsNodePath = "/" + targetID + "/config/enums"
	var enumsNode = app.SelectNodesXML( enumsNodePath )[0]
	
	if ( !prefix )
		prefix = ENUM_DEFAULT_NAME_PREFIX
	
	//	get univoque number
	var i = 1
	var enumCaption
	while (1)
	{
		enumCaption = prefix + i
		var enumNodes = enumsNode.selectNodes( "enum[@caption='" + enumCaption + "']" )
		if ( enumNodes.length == 0 )
			break;
		
		i++
	}
	
	return enumCaption
}

function GetEnumUniqueId()
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var enumsNodePath = "/" + targetID + "/config/enums"
	var enumsNode = app.SelectNodesXML( enumsNodePath )[0]
	var enumNodes
	var id = 0
	
	enumNodes = enumsNode.selectNodes( "enum" )
	
	while ( enumNode = enumNodes.nextNode() )
	{
		var enumId = parseInt( enumNode.getAttribute( "id" ) )
		if ( enumId > id )
			id = enumId
	}
	
	return id + 1
}

function AddEnum()
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var enumsNodePath = "/" + targetID + "/config/enums"
	var enumsNode = app.SelectNodesXML( enumsNodePath )[0]
	
	//	get univoque number
	var enumCaption = GetEnumUniqueCaption()
	//	get univoque id
	var enumId = GetEnumUniqueId()
	
	//	add enum
	var pathNew = app.AddTemplateData("AlDatabase/enum", enumsNodePath, 0, false)
	
	//	change caption
	app.DataSet(pathNew + "/@caption", 0, enumCaption)
	
	//	set id
	app.DataSet(pathNew + "/@id", 0, enumId)
	
	//	change tree caption
	var treeElemPath = app.HMIGetElementPath(TREE, pathNew)
	app.HMISetCaption(TREE, treeElemPath, enumCaption)
	
	//	click elem, show window
	app.HMISetCurElement(TREE, treeElemPath)
	app.OpenWindow(app.HMIGetLinkedWindow(TREE, treeElemPath), "", pathNew)
	app.HMIEditElement( TREE, treeElemPath )
}

function RemoveEnum()
{
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var configNodePath = "/" + targetID + "/config"
	var configNode = app.SelectNodesXML( configNodePath )[0]
	
	var treeElemPath = app.HMIGetCurElementPath(TREE)
	var enumCaption = app.HMIGetCaption(TREE, treeElemPath)
	var dataElemPath = app.HMIGetElementData(TREE, treeElemPath)
	var enumNode = app.SelectNodesXML(dataElemPath)[0];
	if (enumNode.parentNode.nodeName == "sysenums")
		return;
	
	var paramNodes = configNode.selectNodes( "params/param[typetarg = '" + enumCaption + "'] | paramsRO/param[typetarg = '" + enumCaption + "']" )
	if ( paramNodes.length > 0 )
	{
		var msg = app.Translate( "Enumerative '" + enumCaption + "' is used by " + paramNodes.length + " parameters definitions.\n\nIf you remove this enum definition, parameters will be automatically redefined as DINT type\n\nDo you want to remove '" + enumCaption + "'?" )
		var caption = app.Translate( "Delete enum" )
		
		if ( app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONQUESTION | gentypes.MSGBOX.MB_YESNO ) == gentypes.MSGBOX.IDNO )
		{
			return
		}
		
		var paramNode
		while ( paramNode = paramNodes.nextNode() )
		{
			app.CallFunction( targetID + ".ResetEnumType", paramNode )
		}
	}
	
	app.DataDelete(dataElemPath, 0)
	app.HMISetCurElement(TREE, "/ROOT[1]/" + targetID + "[1]")
}

function OnEndEnumEdit(treepath, newtext)
{
	var destpath = app.HMIGetElementData(TREE, treepath)
	var enumNode = app.SelectNodesXML(destpath)[0];
	if (enumNode.parentNode.nodeName == "sysenums")
		return false;
	
	//	current caption
	var caption = app.HMIGetCaption( TREE, treepath )
	
	//	check new name
	var ris  = app.CallFunction( "compiler.isValidVarName", newtext )
	if ( !ris )
	{		
		var msg = app.Translate( "Invalid name specified.\n\nEnum '" + caption + "' will not be renamed" )
		var caption = app.Translate( "Rename enum" )
		
		app.MessageBox( msg, caption, gentypes.MSGBOX.MB_ICONEXCLAMATION )
		
		return false
	}
	
	var targetID = app.CallFunction("logiclab.get_TargetID")
	var configNodePath = "/" + targetID + "/config"
	var configNode = app.SelectNodesXML( configNodePath )[0]
	
	//	update targtype into parameters
	var parameterNodes = configNode.selectNodes( "params/param[typetarg='" + caption + "'] | paramsRO/param[typetarg='" + caption + "']" )
	var parameterNode
	
	while ( parameterNode = parameterNodes.nextNode() )
	{
		genfuncs.SetNode( parameterNode, "typetarg", newtext )
	}

	// lettura vecchia caption
	var curdata = app.HMIGetElementData(TREE, treepath)
	
	// rinfresca la finestra corrente per aggiornare il titolo
	app.OpenWindow(app.HMIGetLinkedWindow(TREE), "", curdata)
}

// prefisso per il xpath di origine nella clipboard per il tree
var TREE_ENUM_CLIPBOARD_PREFIX = "TREE_ENUM:"
var m_enumClipboardCut = false

function EnumTreeCopy()
{
	var curdata = app.HMIGetElementData(TREE, "")
	if (!curdata)
		return
	
	app.Clipboard = TREE_ENUM_CLIPBOARD_PREFIX + curdata
	m_enumClipboardCut = false
}

function EnumTreeCut()
{
	var curdata = app.HMIGetElementData(TREE, "")
	if (!curdata)
		return
	
	app.Clipboard = TREE_ENUM_CLIPBOARD_PREFIX + curdata
	m_enumClipboardCut = true
}

function EnumTreePaste()
{
	var destpath = app.HMIGetElementData(TREE, "")
	
	var srcpath = app.Clipboard
	if (srcpath == undefined || srcpath == "" || srcpath.substr(0, TREE_ENUM_CLIPBOARD_PREFIX.length) != TREE_ENUM_CLIPBOARD_PREFIX || destpath == undefined || destpath == "")
		return
	srcpath = srcpath.substr(TREE_ENUM_CLIPBOARD_PREFIX.length)
	
	// estrae nodo di origine
	var nodeslist = app.SelectNodesXML(srcpath)
	if (nodeslist.length == 0)
		return
	var srcnode = nodeslist[0]
	
	// estrae nodo destinazione
	nodeslist = app.SelectNodesXML(destpath)
	if (nodeslist.length == 0)
		return
	var destnode = nodeslist[0]
		
	// duplica nodo e tutto il suo albero
	var newnode = srcnode.cloneNode(true)
	destnode.appendChild(newnode)
	
	// get unique caption
	var caption = newnode.getAttribute( "caption" )
	caption = GetEnumUniqueCaption( caption + "_copy" )
	newnode.setAttribute( "caption", caption )
	
	// parsa il nodo (per eventuali onloadnode, inserimento albero ecc)
	app.ParseNode(newnode)
	
	if (m_enumClipboardCut)
	{
		// se operazione di taglia cancella il nodo originale
		app.DataDelete(srcpath, 0)
		
		// reset clipboard
		app.Clipboard = ""
	}
	
	var treepath = app.HMIGetElementPath( TREE, app.GetDataPathFromNode( newnode ) )
	app.HMISetCurElement( TREE, treepath )
	app.HMIEditElement( TREE, treepath )
	
	app.ModifiedFlag = true
}

// verifica validità del comando paste sull'albero controllando il prefisso
function EnumUpdateTreePaste(cmd)
{
	if (!app.IsClipboardAvailable())
		return 0
		
	var path = app.Clipboard
	return (path.substr(0, TREE_ENUM_CLIPBOARD_PREFIX.length) == TREE_ENUM_CLIPBOARD_PREFIX) ? 1 : 0
}

function OnUpdateEnumEdit()
{
	var destpath = app.HMIGetElementData(TREE, "")
	var enumNode = app.SelectNodesXML(destpath)[0];
	if (enumNode.parentNode.nodeName == "sysenums")
		return 0;
	else
		return 1;
}
