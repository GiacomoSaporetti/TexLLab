const MRU_ROW_ATTR_NAME = "data-device-id";
const EMPTY_TEMPLATE_ID = -1;

var m_templates = {}	// mappa di template per ogni target

var m_selectedTargetForFilter;
var m_fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject");

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
	// sfondo
	if (m_darkTheme)
		document.body.classList.add("dark");

	// tipi per messagebox
	var gentypes = app.CallFunction("common.GetGeneralTypes")
	MSGBOX = gentypes.MSGBOX

	// visualizzazione MRU
	var recent = window.external.GetRecentFileList()
	if (recent === undefined || recent === null)
		return

	var arr = VBArray(recent).toArray()
	var hideExtraColumns = true
	for (var i = 0; i < arr.length; i++)
	{
		if (!arr[i])
			continue;
		
		var fullPath = arr[i]
		var itemRow = mru.insertRow(-1)
		itemRow.title = fullPath;
		itemRow.commandID = ID_FILE_MRU_FIRST + i  // crea attributo custom con ID del comando
		itemRow.onclick = function () { window.external.SendWindowsMessage(WM_COMMAND, this.commandID, 0, false) }
		var itemCol = itemRow.insertCell(0)
		itemCol.innerText = GetFileName(fullPath);

		// controlla se presenti informazioni aggiuntive sul progetto
		var extraInfo = app.ReadINIString("Recent File List Project Info", fullPath, "");
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
				extraInfo = null;
		}
		
		if(!extraInfo)
		{
			// filtro in base al target selezionato: setto un attributo vuoto per non farli matchare mai nel filtro
			itemRow.setAttribute(MRU_ROW_ATTR_NAME, "");
			itemCol = itemRow.insertCell(-1)
			var span = document.createElement("span")
			span.innerText = app.Translate("N/A")
			itemCol.appendChild(span)
			itemCol.colSpan  = 5
			
		}
	}
		
	if(hideExtraColumns)
		mru.classList.add("hide-extra-columns");

	// abilitazione LLScan
	LLScanButton.style.display = LLSCANSETTINGS.enable ? "" : "none";

	PopulateTargetList();

	// per togliere rettangolo di selezioen dal bottone "new prj"
	window.focus()
}

function OpenPrj()
{
	// postmessage con il comando di 'file / open project'
	window.external.SendWindowsMessage(WM_COMMAND, IDM_OPENPRJ, 0, false)
}

function OpenImportPrjFromTarget()
{
	// postmessage con il comando di 'file / Import project from target'
	window.external.SendWindowsMessage(WM_COMMAND, ID_FILE_IMPORTPROJECTFROMTARGET, 0, false)
}

/**
 * Restituisce informazioni extra sul progetto dell'MRU
 * @param {*} extraInfo 
 * @returns 
 */
function ExtraInfoToObject(extraInfo)
{
	var extraInfoData = extraInfo.split("|")
	var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[@deviceid = '" + extraInfoData[0] + "']")
	if (!nodelist || nodelist.length == 0)
		return null

	var res = {}
	res.name = nodelist[0].getAttribute("caption");
	res.version = nodelist[0].getAttribute("version");
	if (extraInfoData.length >= 4)
	{
		res.appName = extraInfoData[1]
		res.appVersion = extraInfoData[2]
		res.appAuthor = extraInfoData[3]
	}
	else
	{
		res.appName = ""
		res.appVersion = ""
		res.appAuthor = ""
	}

	return res
}


/**
 *
 * @param {string} targetId è il nome completo del target selezionato
 * @param {number} targetIndex indice del target selezionato nella tabella
 */
function selectCurrentItem(targetId, targetName, targetIndex) {
	LoadTemplates(targetId);

	// uso la var globale perche' li rifiltro dopo aver fatto andare lo scan
	m_selectedTargetForFilter = targetId;

	//serve semplicemente per evidenziare nella tabella il target selezionato
	for (i = 0; i< catalogTbl.rows.length; i++) {
		var row = catalogTbl.rows.item(i);
		if (i == targetIndex)
			row.className += " list-item-selected";
		else
			row.className = "";
	}

	mruFilterContainer.style.display = "block";
	mruFilterName.innerText = targetName;

	scanFilterContainer.style.display = "block";
	scanFilterName.innerText = targetName;

	FilterTargets();
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
	scanFilterContainer.style.display = "none";
	m_selectedTargetForFilter = null;
}

function LoadTemplates(targetID) {
	templatesTbl.innerHTML = targetID;

	if (!targetID) {
		templatesTbl.appendChild(BuildSelectTargetItem());
		return;
	}

	let templatesList = m_templates[targetID];

	if (templatesList && templatesList.length > 0) {
		templatesList.forEach(function(item) {
			templatesTbl.appendChild(BuildTemplateItem(item, item.id));
		});
	}
	else {
		let empty = {
			caption: app.Translate(""),
			descr: app.Translate(""),
		}

		templatesTbl.appendChild(BuildTemplateItem(empty, EMPTY_TEMPLATE_ID));
	}

	function BuildTemplateItem(item, templId) {
		templId = templId ? templId : EMPTY_TEMPLATE_ID;

		let tr = document.createElement("tr");
		tr.id = templId;
		let td = document.createElement("td");
		td.className = "catalog-item template";

		let div = document.createElement("div");
		let span1 = document.createElement("span");
		let span2 = document.createElement("span");

		span1.innerText = item.caption ? item.caption : app.Translate("Empty");
		span2.innerText = item.descr ? item.descr : app.Translate("Creates an empty project");

		tr.onclick = createTemplateOnClickHandler(targetID, templId);

		div.appendChild(span1);
		div.appendChild(span2);
		td.appendChild(div);
		tr.appendChild(td);

		return tr;
	}

	function BuildSelectTargetItem() {
		let tr = document.createElement("tr");
		let td = document.createElement("td");
		td.className = "catalog-item template disabled";

		let div = document.createElement("div");
		let span1 = document.createElement("span");
		let span2 = document.createElement("span");

		span1.innerText = app.Translate("No target selected");
		span2.innerText = app.Translate("Select a target to see the available templates");

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

function createTemplateOnClickHandler(targetId, targetTemplate)
{
	return function () { CreateNewPrj(targetId, targetTemplate) };
}

function CreateNewPrj(targetId, targetTemplate)
{
	//verifica progetto selezionato
	if (!targetId)
		return;

	// se c'e' il template viene passato, altrimenti no
	var templatePrjID = (targetTemplate != EMPTY_TEMPLATE_ID) ? targetTemplate : "";
	app.CallFunction("extfunct.CreateNewProject", targetId, templatePrjID);
}

function compareStr(a,b)
{
	if ( a < b )
		return -1
	else if ( a > b )
		return 1
	else
		return 0
}

function compareTargets(a,b) 
{
	if (parseInt(a.order) < parseInt(b.order))
		return -1;
	if (parseInt(a.order) > parseInt(b.order))
		return 1;
	
	return compareStr(a.name,b.name)
}	

function OnShowAllVersions(show)
{
	// prevenzione errori stupidi se ho tolto la visualizzazione di tutti i target (puo' essere che fosse stato selezionato un target che ora e' nascosto)
	RemoveTargetFilter();
	LoadTemplates();

	PopulateTargetList();
}

function PopulateTargetList()
{
	var showall = chkShowAllVersions.checked
	// lettura device con supporto targetdef
	var nodelist = app.CallFunction("extfunct.QueryCatalog", "//deviceinfo[targetdef]")
	var node
	var targetList = []
	
	if (nodelist)
	{
		while (node = nodelist.nextNode())
		{
			if (!showall && !ParseBoolean(node.getAttribute("isDefaultVersion")))
				continue
			if (node.selectSingleNode("targetdef").getAttribute("visible") == "false")
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
			let templateNodes = node.selectNodes("targetdef/templateprj");
			let templateNode;
			while(templateNode = templateNodes.nextNode()) {
				let templateObj = {
					id: templateNode.getAttribute("id"),
					descr: templateNode.getAttribute("descr"),
					caption: templateNode.getAttribute("caption"),
					link: GetNodeText(templateNode)
				}

				templatesList.push(templateObj);
			}

			m_templates[targetID] = templatesList;
		}

		//ordino i target secondo algoritmo di sort
		targetList.sort(compareTargets);

		catalogTbl.innerHTML = ""
	
		for (var i = 0; i < targetList.length; i++) {
			var target = targetList[i];
			var row = catalogTbl.insertRow(-1);

			row.onclick = createTargetOnClickHandler(target.targetID, target.name, i);

			// se manca l'icona metto di default l'icona di LL
			let imgSrc = target.image;
			if (!m_fso.FileExists(imgSrc))
				imgSrc = "img\\LLLogo.png";

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

		// all'inizio costruisce l'elemento vuoto
		LoadTemplates();
	}
}