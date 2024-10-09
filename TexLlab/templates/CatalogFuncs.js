var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var gentypes = app.CallFunction("common.GetGeneralTypes")

var enuCatalogModes =
{
	CAT_DLG_NONE	: 0,
	CAT_DLG_DISPLAYMODE	: 1,
	CAT_DLG_SELECTBTN	: 2,
	CAT_DLG_QUERYMODE	: 4,
	CAT_DLG_ALLVERSIONS	: 8,
	CAT_DISABLECACHE	: 16,
	CAT_DLG_TREEVIEW	: 32,
	CAT_DLG_SMALLICONS	: 64,
	CAT_TRANSPCOLOR_MAGENTA	: 128,
	CAT_TREE_HASLINES	: 256,
	CAT_TREE_LINESATROOT: 512
};

function GetCatalogModes()
	{ return enuCatalogModes; }

function Init(intf)
{
	// istanzia l'estensione catalog a partire dall'oggetto attivo all'interno di LogicLab
	app.CallFunction("extfunct.InitCatalogExtension")
	
	// imposta il catalogmng in modalità querymode (senza albero) e show all versions
	var flags = enuCatalogModes.CAT_DLG_QUERYMODE | enuCatalogModes.CAT_DLG_ALLVERSIONS;
	flags |= enuCatalogModes.CAT_DLG_TREEVIEW;    // necessario per EtherCAT ! altrimenti si può togliere e usare lista flat
	
	app.CallFunction("catalog.SetBehaviour", flags);
	
	app.CallFunction("catalog.SetPopupMenuName", "catalogPopup")
	
	try
	{
		if(app.IsDarkTheme())
			app.CallFunction("catalog.SetDarkTheme", 1)
	}
	catch(err){}
	
	return 1
}

//------------------------------------------------------------------ COMANDI PROVENIENTI DAL CATALOG ----------------------------------------------
function GetSelectedCatalogNode()
{
	// @id dell'elemento attivo nel listCtrl
	var id = app.CallFunction("catalog.GetSelectedItemID")
	if (id < 0)
		return
	
	// nodo xml <deviceinfo> dell'elemento selezionato
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@id = " + id + "]")
	if (nodelist && nodelist.length != 0)
		return nodelist[0]
}

function OnCatalogDelete()
{
	var node = GetSelectedCatalogNode()
	if (!node) return
	
	// path del template, deve iniziare con Custom\Gft
	var template = node.getAttribute("template")

	// conferma cancellazione
	if (app.MessageBox(app.Translate("Are you sure you want to delete\n%1 ?").replace("%1", template), "", 
		gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_OKCANCEL) == gentypes.MSGBOX.IDCANCEL)
		return
	
	try
	{
		var fso = new ActiveXObject("Scripting.FileSystemObject")
		fso.DeleteFile(app.CatalogPath + template, true)
	}
	catch (e)
	{
		// errore durante la delete
		app.MessageBox(app.Translate("Could not delete\n") + template, "", gentypes.MSGBOX.MB_ICONERROR)
		return
	}
	
	// se cancellazione ok ricarica il catalogo
	app.CallFunction("catalog.ResetCache", "")
	app.CallFunction("catalog.Load", app.CatalogPath)
	// rifresca il CatalogList
	app.CallFunction("common.OnTreeClick")
}

function OnUpdateCatalogDelete()
{
	var node = GetSelectedCatalogNode()
	if (!node) return
	
	var editingEnabled = genfuncs.ParseBoolean(node.getAttribute("editingEnabled"))
	if (editingEnabled)
		// i device fatti con ModbusCustomEditor si possono cancellare
		return 1
	
	var fromEDS = genfuncs.ParseBoolean(node.getAttribute("importedFromEDS"))
	var fromESI = genfuncs.ParseBoolean(node.getAttribute("importedFromESI"))
	if (fromEDS || fromESI)
		// i device importati da EDS o ESI si possono cancellare
		return 1
	
	return 0
}

function OnCatalogEdit()
{
	var node = GetSelectedCatalogNode()
	if (!node) return
	
	var template = app.CatalogPath + node.getAttribute("template")
	
	var id = node.getAttribute("deviceid")
	if ( id.substr(0, 9) == "CANcustom" )
		app.CallFunction("CANcustom.RunCANcustomEditor", 0, template)
	else
		app.CallFunction("ModbusCustom.RunModbusCustomEditor", 0, template)
}

function OnUpdateCatalogEdit()
{
	var node = GetSelectedCatalogNode()
	if (!node) return
	
	// comando "edit" attivo solo se c'è l'attributo messo da ModbusCustomEditor
	var editingEnabled = genfuncs.ParseBoolean(node.getAttribute("editingEnabled"))
	return editingEnabled ? 1 : 0
}

function OnViewCatalog()
{
	var vis = app.IsControlBarVisible("catalogdock")
	app.ShowControlBar_byName("catalogdock", !vis)
}

function OnUpdateViewCatalog()
{
	return app.IsControlBarVisible("catalogdock") ? 0x10001 : 0x00001
}

function OnShowAllVersions()
{
	var mode = app.CallFunction("catalog.get_Behaviour");
	// toggle del bit
	mode = mode ^ enuCatalogModes.CAT_DLG_ALLVERSIONS;
		
	app.CallFunction("catalog.SetBehaviour", mode);
	// rifresca il CatalogList
	app.CallFunction("catalog.Refresh", false);
}

function OnUpdateShowAllVersions()
{
	var mode = app.CallFunction("catalog.get_Behaviour");
	var showAll = (mode & enuCatalogModes.CAT_DLG_ALLVERSIONS) != 0;
	return showAll ? 0x10001 : 0x00001;
}

function OnExportSourceFiles()
{
	var node = GetSelectedCatalogNode();
	if (!node)
		return;
	
	var destDir = app.CallFunction("commonDLL.ShowBrowseFolderDlg");
	if (!destDir)
		return;
	
	var fso = new ActiveXObject("Scripting.FileSystemObject");
	
	var files = node.selectNodes("sourceFiles/sourceFile");
	var file;
	while (file = files.nextNode())
	{
		var src = app.CatalogPath + fso.GetParentFolderName(node.getAttribute("template")) + "\\" + file.text;
		var dst = destDir + "\\" + fso.GetFileName(file.text);
		
		if (fso.FileExists(dst))
			if (app.MessageBox(genfuncs.FormatMsg(app.Translate("File already exists:\n%1\nOverwrite?"), dst), "", gentypes.MSGBOX.MB_ICONQUESTION|gentypes.MSGBOX.MB_OKCANCEL) != gentypes.MSGBOX.IDOK)
				return;
			
		fso.CopyFile(src, dst, true);
	}
}

function OnUpdateExportSourceFiles()
{
	var hasSourceFiles = false;
	var node = GetSelectedCatalogNode();
	if (node)
		hasSourceFiles = node.selectNodes("sourceFiles/sourceFile").length != 0;
	
	return hasSourceFiles ? 1 : 0;
}
