
var app = window.external;
var m_fso = app.CreateObject("Scripting.FileSystemObject")
var m_templates = {}

const MRU_ROW_ATTR_NAME = "data-device-id";
const EMPTY_TEMPLATE_ID = -1;

function GetFileName(path)
{
	// estrae solo il nome del file togliendo path e ext
	var pos = path.lastIndexOf("\\")
	if (pos != -1)
		path = path.substring(pos + 1)
		
	pos = path.lastIndexOf(".")
	if (pos != -1)
		path = path.substring(0, pos)
	return path
}

function InitPage()
{
	var shell = app.CreateObject("WScript.Shell");
	
	// visualizzazione MRU
	var recent = app.GetRecentFileList()
	if ( recent === undefined || recent === null )
		return
		
	var hideExtraColumns = true
	let INIPath = "%AppData%\\PageLab.ini";
	let fullINIPath = shell.ExpandEnvironmentStrings(INIPath);
	let INIFile = ReadUTF16INI(fullINIPath);

	var arr = VBArray(recent).toArray()
	for (var i = 0; i < arr.length; i++) {
		if (!arr[i])
			continue;
			
		var fullPath = arr[i]

		var itemRow = mru.insertRow(-1)
		itemRow.title = fullPath;
		itemRow.commandID = ID_FILE_MRU_FIRST + i  // crea attributo custom con ID del comando
		itemRow.onclick = function () { app.SendWindowsMessage(WM_COMMAND, this.commandID, 0, false) }
		var itemCol = itemRow.insertCell(0)
		itemCol.innerText = GetFileName(fullPath);

		// controlla se presenti informazioni aggiuntive sul progetto
		var extraInfo = INIFile.GetINIValue("Recent File List Project Info", fullPath, true);
		if (extraInfo)
		{	
			var extraInfoData = ExtraInfoToObject(extraInfo)
			if (extraInfoData)
			{
				for (var key in extraInfoData)
				{
					// attributo per il filtro in base al target selezionato
					itemRow.setAttribute(MRU_ROW_ATTR_NAME, extraInfo.split("|")[0]);

					itemCol = itemRow.insertCell(-1)
					var span = document.createElement("span")
					span.innerText = extraInfoData[key]
					itemCol.appendChild(span)
					
					hideExtraColumns = false
				}
			}
			else
				extraInfo = null
		}
		
		if(!extraInfo)
		{
			itemCol = itemRow.insertCell(-1)
			var span = document.createElement("span")
			span.innerText = "N/A";
			itemCol.appendChild(span)
			itemCol.colSpan = 2
		}
	}

	if(hideExtraColumns)
		mru.classList.add("hide-extra-columns");

	//#region target list

	// lettura device con supporto HMIdef
	var nodelist = app.QueryCatalog("//deviceinfo[HMIdef]")
	var node
	var targetList = []

	if (nodelist)
	{
		while (node = nodelist.nextNode())
		{
			if (node.selectSingleNode("HMIdef").getAttribute("visible") == "false")
				continue

			// dati del device corrente
			var targetID = node.getAttribute("deviceid")

			// se il flag "show all version" non è attivo mostra solo la versione major
			var version = node.getAttribute("version");

			var order = node.getAttribute("order")
			if(!order)
				order = 99

			var descriptionNode = node.selectSingleNode("description")

			var target = {
				image: node.getAttribute("image"), 
				targetID: targetID,
				name: node.getAttribute("caption"),
				version: version,
				order: parseInt(order)
			};

			//controllo che ci sia la descrizione 
			if(descriptionNode)
				target.description = descriptionNode.text;

			targetList.push(target)

			let templatesList = [];
			// progetti template
			let templateNodes = node.selectNodes("HMIdef/templateprj[@id]");
			let templateNode;
			while(templateNode = templateNodes.nextNode()) {
				templatesList.push({
					id: templateNode.getAttribute("id"),
					descr: templateNode.getAttribute("descr"),
					caption: templateNode.getAttribute("caption"),
					link: templateNode.text
				});
			}

			m_templates[targetID] = templatesList;
		}

		//ordino i target secondo algoritmo di sort
		targetList.sort(compareTargets);

		for (var i = 0; i < targetList.length; i++) {
			var target = targetList[i];
			var row = catalogTbl.insertRow(-1);

			row.onclick = createTargetOnClickHandler(target.targetID, target.name, i);

			// se manca l'icona metto di default l'icona di LL
			let imgSrc = target.image;
			if (!m_fso.FileExists(imgSrc))
				imgSrc = "img\\PLLogo.png";

			// la scritta "Version" che si vede sulla versione e' definita nel CSS
			let HTML = "<img alt='" + target.name + "' src='" + imgSrc + "'> \
						<div> \
							<span>" + target.name + "</span> \
							<span>" + target.version + "</span> \
							<span>" + target.description + "</span> \
						</div>";
			let cell = document.createElement('td');
			cell.className = "catalog-item target";
			cell.innerHTML = HTML;
			row.appendChild(cell);
		}
	}
	//#endregion

	// per togliere rettangolo di selezioen dal bottone "new prj"
	window.focus()
}

/**
 *
 * @param {string} targetId è il nome completo del target selezionato
 * @param {number} targetIndex indice del target selezionato nella tabella
 */
function selectCurrentItem(targetId, targetName, targetIndex) {
	LoadTemplates(targetId);

	//serve semplicemente per evidenziare nella tabella il target selezionato
	for (i = 0; i< catalogTbl.rows.length; i++) {
		var row = catalogTbl.rows.item(i);
		if (i == targetIndex)
			row.className += " list-item-selected";
		else
			row.className = "";
	}

	// uso la var globale perche' li rifiltro dopo aver fatto andare lo scan
	m_selectedTargetForFilter = targetId;

	mruFilterContainer.style.display = "block";
	mruFilterName.innerText = targetName;

	FilterTargets(targetId);
}

function FilterTargets() {
	if (!m_selectedTargetForFilter)
		return;

	// filtra i progetti recenti in base al target selezionato
	let mruRows = document.querySelectorAll("[" + MRU_ROW_ATTR_NAME + "]");
	for (let i = 0; i < mruRows.length; i++) {
		let row = mruRows[i];
		let rowAttr = row.getAttribute(MRU_ROW_ATTR_NAME);
		row.style.display = (rowAttr == m_selectedTargetForFilter) ? "" : "none"
	}
}

function RemoveTargetFilter() {
	let mruRows = document.querySelectorAll("[" + MRU_ROW_ATTR_NAME + "]");
	for (let i = 0; i < mruRows.length; i++) {
		let row = mruRows[i];
		row.style.display = "";
	}

	mruFilterContainer.style.display = "none";
	m_selectedTargetForFilter = null;
}

function LoadTemplates(targetID) {
	templatesTbl.innerHTML = "";

	let templatesList = m_templates[targetID];

	// creo sempre un empty di default perche' non vengono caricati template vuoti dal PCT (al contrario di LogicLab che apre un plcprj vuoto come base)
	let empty = {
		caption: "Empty",
		descr: "Creates an empty project",
	}
	templatesTbl.appendChild(BuildTemplateItem(empty, EMPTY_TEMPLATE_ID));

	if (templatesList && templatesList.length > 0) {
		templatesList.forEach(function(item) {
			templatesTbl.appendChild(BuildTemplateItem(item, item.id));
		});
	}

	function BuildTemplateItem(item, id) {
		id = id ? id : EMPTY_TEMPLATE_ID;

		let tr = document.createElement("tr");
		tr.id = id;
		let td = document.createElement("td");
		td.className = "catalog-item template";

		let div = document.createElement("div");
		let span1 = document.createElement("span");
		let span2 = document.createElement("span");

		span1.innerText = item.caption ? item.caption : "Empty";
		span2.innerText = item.descr ? item.descr : "Creates an empty project";

		tr.onclick = createRecentTemplateOnClickHandler(targetID, id);

		div.appendChild(span1);
		div.appendChild(span2);
		td.appendChild(div);
		tr.appendChild(td);

		return tr;
	}
}

// ritorna una closure che cattura i parametri, da usare come handler di onclick della griglia
function createTargetOnClickHandler(targetID, targetName, i)
{
	return function () { selectCurrentItem(targetID, targetName, i); };
}

function createRecentTemplateOnClickHandler(targetId, targetTemplate)
{
	return function () { CreateNewPrj(targetId, targetTemplate) };
}

function CreateNewPrj(targetId, targetTemplate)
{
	//verifica progetto selezionato
	if (!targetId)
		return;

	// se c'e' il template viene passato, altrimenti no
	if (targetTemplate != EMPTY_TEMPLATE_ID)
		app.CreateNewProject(targetId, targetTemplate);
	else
		app.CreateNewProject(targetId, "");
}

// da resource.h
var IDM_OPEN_PROJECT = 36008
// da winuser.h
var WM_COMMAND = 0x0111
// da afxres.h
var ID_FILE_MRU_FIRST = 0xE110

function OpenPrj()
{
	// postmessage con il comando di 'file / open project'
	app.SendWindowsMessage(WM_COMMAND, IDM_OPEN_PROJECT, 0, false)
}

function ExtraInfoToObject(extraInfo)
{
	let extraInfoData = extraInfo.split("|");

	let res = {};
	res.appName = extraInfoData[1] ? extraInfoData[1] : "-";
	res.appVersion = extraInfoData[2] ? extraInfoData[2] : "-";
	return res;
}

function compareTargets(a,b) 
{
	function compareStr(a,b)
	{
		if ( a < b )
			return -1
		else if ( a > b )
			return 1
		else
			return 0
	}

	if (parseInt(a.order) < parseInt(b.order))
		return -1;
	if (parseInt(a.order) > parseInt(b.order))
		return 1;

	return compareStr(a.name,b.name)
}

// --------------------------------------- GESTIONE FILES INI ----------------------------------
// costanti per fso.OpenTextFile
var enuOpenTextFileModes = {
	ForReading: 1,
	ForWriting: 2,
	ForAppending: 8
}

function INIFile(path)
{
	this.path = path
	this.sections = new Object
	this.putBlankSeparator = false
	this.caseSensitive = true
}

function NewINI(path)
{
	return new INIFile(path)
}

/*
function ReadINI(inipath, caseSensitive)
{
	if (!m_fso.FileExists(inipath))
		return
		
	var f = m_fso.OpenTextFile(inipath, enuOpenTextFileModes.ForReading)
	var s
	var ini = new INIFile(inipath)
	
	if (caseSensitive != undefined)
		ini.caseSensitive = caseSensitive
		
	var sectionName, key, value
	var section
	
	while (!f.AtEndOfStream)
	{
		s = f.ReadLine()
		if (s.length == 0)
			continue
			
		// commento
		if(s.indexOf(";") == 0)
			continue;
			
		if (s.substr(0, 1) == "[" && s.substr(s.length-1, 1) == "]")
		{
			if (section)
				ini.sections[sectionName] = section
				
			section = new Object
			sectionName = s.substr(1, s.length-2)
			
			if (!ini.caseSensitive)
				sectionName = sectionName.toUpperCase()
		}
		else if (section)
		{
			var pos = s.indexOf("=")
			if (pos != -1)
			{
				key = s.substr(0, pos)
				value = s.substr(pos+1)
				
				if (!ini.caseSensitive)
					key = key.toUpperCase()
					
				section[key] = value
			}
		}
	}
	f.Close()
	
	if (section)
		ini.sections[sectionName] = section
		
	return ini
}
*/

function ReadUTF16INI(inipath, caseSensitive)
{
	if (!m_fso.FileExists(inipath))
		return
	
	var strData;
	// lettura unicode UTF16
	var objStream = app.CreateObject("ADODB.Stream");
	objStream.CharSet = "utf-16";
	objStream.Open();
		
	try
	{
		objStream.LoadFromFile(inipath)
		strData = objStream.ReadText()
	}
	catch (ex)
	{
		return;
	}
		
	objStream.Close();
	
	var s
	var ini = new INIFile(inipath)
	
	if (caseSensitive != undefined)
		ini.caseSensitive = caseSensitive
		
	var sectionName, key, value
	var section
	
	var rows = strData.split("\n");	
	for (var i = 0; i < rows.length; i++)
	{
		var s = rows[i];
		s = s.replace(/(\r\n|\n|\r)/gm, ""); // pulizia
		
		if (s.length == 0)
			continue
			
		// commento
		if(s.indexOf(";") == 0)
			continue;
			
		if (s.substr(0, 1) == "[" && s.substr(s.length-1, 1) == "]")
		{
			if (section)
				ini.sections[sectionName] = section
				
			section = new Object
			sectionName = s.substr(1, s.length-2)
			
			if (!ini.caseSensitive)
				sectionName = sectionName.toUpperCase()
		}
		else if (section)
		{
			var pos = s.indexOf("=")
			if (pos != -1)
			{
				key = s.substr(0, pos)
				value = s.substr(pos+1)
				
				if (!ini.caseSensitive)
					key = key.toUpperCase()
					
				section[key] = value
			}
		}
	}
	
	if (section)
		ini.sections[sectionName] = section
		
	return ini
}

/*
INIFile.prototype.WriteINI = function (path,headerComment)
{
	if ((path == "" || path == undefined) && this.path != "")
		path = this.path
		
	MakeBackup(path)
	var f = SafeCreateTextFile(path)
	var name, key
	
	if (headerComment)
		f.WriteLine(";" + headerComment )
	
	for (name in this.sections)
	{
		f.WriteLine("[" + name + "]")
		
		var curSection = this.sections[name]
		for (key in curSection)
			f.WriteLine(key + "=" + curSection[key])
			
		if (this.putBlankSeparator)
			f.WriteLine("") // riga vuota di separazione dopo ogni sezione
	}
	f.Close()
}
*/

INIFile.prototype.GetINIValue = function (section, key, undefinedIfNotFound)
{
	if (section == "" || key == "")
		return ""
	
	if (!this.caseSensitive)
	{
		section = section.toUpperCase()
		key = key.toUpperCase()
	}
	
	var curSection = this.sections[section]
	if (curSection != undefined)
	{
		var value = curSection[key]
		if (value != undefined)
			return value
	}
	
	if (undefinedIfNotFound)
		return undefined
	else
		return ""
}

INIFile.prototype.GetINISection = function (section)
{
	if (!this.caseSensitive)
		section = section.toUpperCase()
	
	return this.sections[section]
}

/*
INIFile.prototype.PutINIValue = function (section, key, value)
{
	if (value == undefined)
		AddLog(enuLogLevels.LEV_WARNING, "PutINIValue", "INI: value for " + section + "." + key + " is undefined")
	else if (value == null)
		AddLog(enuLogLevels.LEV_WARNING, "PutINIValue", "INI: value for " + section + "." + key + " is null")
	else if (typeof value == "number" && isNaN(value))
		AddLog(enuLogLevels.LEV_WARNING, "PutINIValue", "INI: value for " + section + "." + key + " is NaN")
		
	if (section == "" || key == "")
		return
	
	var curSection = this.sections[section]
	if (curSection == undefined)
	{
		curSection = new Object
		this.sections[section] = curSection
	}
	
	curSection[key] = value
}
*/