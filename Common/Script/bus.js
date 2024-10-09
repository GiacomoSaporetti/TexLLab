// FUNZIONI SCRIPT COMUNI PER LE PAGINE DI BUS LOCALE CON LAYOUT A RACK

function SaveBusTableScrollPos()
{
	var container = document.getElementById("busTableContainer2")
	if (container)
		app.TempVar("busTableContainer.ScrollLeft") = container.scrollLeft
}

function LoadBusTableScrollPos()
{
	var pos = app.TempVar("busTableContainer.ScrollLeft")
	app.TempVar("busTableContainer.ScrollLeft") = undefined
	
	var container = document.getElementById("busTableContainer2")
	if (container && pos)
		container.scrollLeft = pos
}

function ReloadPage()
{
	SaveBusTableScrollPos()
		// per forzare il refresh della pagina
	history.go(0)
}

function slotchange(n)
{
	// datapath del documento, toglie lo "/" finale
	var path = datapath.value.slice(0, -1)

	// elenco di nodi degli slot
	var nodelist = window.external.SelectNodesXML(path + "/*[@insertable]")
	var i, tot
	var numSlots = nodelist.length
	var skipcpu = 0
	
	if (n < numSlots)
	{
		// conferma riduzione nodi
		if (!confirm("Are you sure ?"))
		{
			document.getElementById("slots" + numSlots).checked = true
			return false
		}
		
		app.SaveUndoSnapshot()
		app.Feature(featUndoEnable) = false
		
		var endIdx = n
		if (numSlots == 18)
		{
			// se 18 slot ne toglie uno poichè c'è anche lo switch
			endIdx++
			window.external.DataDelete(path + "/switchslot", 0)
		}
			
		for (i = numSlots - 1; i >= endIdx; i--)
		{
			// cancella i nodi dalla coda a ritroso
			var itempath = window.external.GetDataPathFromNode( nodelist[i] )
			window.external.DataDelete(itempath, 0)
		}
	}
	else if (n > numSlots)
	{
		app.SaveUndoSnapshot()
		app.Feature(featUndoEnable) = false
		
		var tot = n - numSlots
		if (n == 18)
		{
			// se 18 slot ne aggiunge un emptyslot in meno poichè viene già aggiunto anche lo switch
			tot--
			window.external.AddTemplateData("switchslot", window.external.GetDataPathFromNode(nodelist[1]), 2, false)
			skipcpu = 1
		}
			
		for (i = 0; i < tot; i++)
			// aggiunge slot vuoti
			window.external.AddTemplateData("emptyslot", path, 0, false)
	}
	
	// setta subito il nuovo numero di slot per includerlo nell'undo; SLOTSPATH deve essere definito nella pagina chiamante
	app.DataSet(datapath.value + SLOTSPATH, 0, n)
	
	app.Feature(featUndoEnable) = true
	
	// imposta l'attributo skipslot sulla cpu se 18 slot
	nodelist = window.external.SelectNodesXML(path + "/cpuslot")
	if (nodelist.length != 0)
		nodelist[0].setAttribute("skipSlot", skipcpu)
		
	ReloadPage()
}

var m_imgToNode = {}

function InitPage()
{
	var COLOR_DISABLED = "#e0e0e0"
	
	// estrae nome del nodo xml del device principale (sopra il bus)
	var list = window.external.SelectNodesXML(datapath.value + "..")
	var devicename = list[0].nodeName
	
	list = window.external.SelectNodesXML(datapath.value + "*[@insertable]")
	var node
	var i = 0
	var slotName
	while (node = list.nextNode())
	{
		var newcol = busTable.rows[0].insertCell(-1)
		
		var name = ""
		var img = ""
		var bg = ""

		if (node.nodeName == "cpuslot")
		{
			name = "CPU"
			bg = COLOR_DISABLED
			// come immagine della CPU mette l'immagine del device principale (cpu300,etm100 ecc)
			var nodelist = window.external.CallFunction("catalog.Query", "//deviceinfo[@deviceid='" + devicename + "']")
			if (nodelist.length != 0)
			{
				name = nodelist[0].getAttribute("name")
				img = nodelist[0].getAttribute("image")
			}
		}
		else if (node.nodeName == "emptyslot")
		{
			name = "empty"
			img = csspath + "../img/emptyslot_big.jpg"
		}
		else if (node.nodeName == "switchslot")
		{
			name = "switch"
			img = csspath + "../img/switch_big.jpg"
			bg = COLOR_DISABLED
		}
		else
		{
			// estrae l'immagine da usare per la scheda dal catalogo
			var nodelist = window.external.CallFunction("catalog.Query", "//deviceinfo[@deviceid='" + node.nodeName + "']")
			if (nodelist.length != 0)
			{
				name = nodelist[0].getAttribute("name")
				img = nodelist[0].getAttribute("image")
			}
		}
		
		newcol.id = "slot" + i
		
		if (list.length == 18)
		{
			// se bus a 18 slot i primi due non sono indirizzabili e vengono saltati nella numerazione
			if (i < 2)
				slotName = "&nbsp;"
			else 
				slotName = i - 1
		}
		else
			slotName = i + 1
			
		newcol.innerHTML = "<span class='SlotName'>" + name + "</span><br>\
<img id='imgSlot" + i + "' ondrop='onDrop()' ondragover='onDragOver()' oncontextmenu='ShowPopup()' onclick='ShowSlot(" + i + ")' src='" + img + "'><br>\
<span class='SlotName'>" + slotName + "</span>"

		if (bg)
			newcol.style.background = bg
			
		m_imgToNode["imgSlot" + i] = node
		
		i++
	}
	
	LoadBusTableScrollPos()
}

var m_curSlot = -1

function ShowSlot(num)
{
	var slot = window.external.SelectNodesXML(datapath.value + "*[@insertable]")[num]
	if (slot.nodeName == "cpuslot" || slot.nodeName == "switchslot" || slot.nodeName == "emptyslot")
		return
		
	var win = slot.getAttribute("window")
	if (win)
	{
		win = window.external.GetWindowLink(win)
		document.getElementById("slotFrame").src = win + "?datapath=" + window.external.GetDataPathFromNode(slot) + "/"
		document.getElementById("slotFrame").style.visibility = "visible"
	}
	else
		document.getElementById("slotFrame").src = ""
	
	if (m_curSlot != -1)
		document.getElementById("slot" + m_curSlot).style.background = ""
		
	//document.getElementById("slot" + num).style.background = "#d0e4ed" 208,228,237 
	//document.getElementById("slot" + num).style.background = "#00b4ff" 0,180,255 
	document.getElementById("slot" + num).style.background = "#00b4ff" //0,180,255 
	m_curSlot = num
}

function ChangeNode(oldnode, deviceid)
{
	var app = window.external
	
	// ottiene il data del nodo corrente (su cui si è cliccato)
	var curdata = app.GetDataPathFromNode(oldnode)
	
	if (oldnode.nodeName != "emptyslot")
		// invia msg broadcast
		window.external.SendMessage("CardChange", curdata)
	
	var retval = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + deviceid + "']")
	if (!retval || retval.length == 0) return
	
	var template = retval[0].getAttribute("template")
	if (!template) return
	
	// carica il template corretto
	if (! app.LoadTemplate(template, -1)) return
	
	app.SaveUndoSnapshot()
	app.Feature(featUndoEnable) = false
	
	// aggiunge il template dati alla posizione data attuale e riceve il data path
	var datapath = app.AddTemplateData(deviceid, curdata, 1)
	
	// se l'inserimento viene annullato (es dentro una onloadnode, vedi R-GCANm) la AddTemplateData ritorna "/"
	if (datapath && datapath != "/")
	{
		// costruzione caption
		var caption = app.CallFunction("common.GenerateCaption", deviceid)
		app.DataCreate(datapath + "/@caption", 0, caption)
		
		// assegna l'id univoco al device
		app.CallFunction("common.AssignUniqueID", datapath)
		
		// invia messaggio broadcast
		app.SendMessage("CardAdded", datapath)
	}
	
	app.Feature(featUndoEnable) = true
	
	ReloadPage()
}


// This function is called by the target object in the ondrop event.
function onDrop()
{
	var text = event.dataTransfer.getData("Text")
	if (text)
	{
		var result = window.external.CallFunction("common.ParseDragDropText", text)
		if (!result) return
		
		var oldnode = m_imgToNode[event.srcElement.id]
		if (oldnode.nodeName == "cpuslot" || oldnode.nodeName == "switchslot")
			return
			
		ChangeNode(oldnode, result.deviceid)
	}
	
	event.returnValue = false
}

function onDragOver()
{
	var ok = false
	if (event.dataTransfer.getData("Text"))
		ok = true
		
	event.dataTransfer.dropEffect = ok ? "copy" : "none"
	event.returnValue = false
}

function DeleteCard()
{
	if (m_curSlot == -1) return

	var slotname = m_imgToNode["imgSlot" + m_curSlot].nodeName
	if (slotname == "emptyslot" || slotname == "switchslot" || slotname == "cpuslot")
		return
		
	var curdata = window.external.GetDataPathFromNode(m_imgToNode["imgSlot" + m_curSlot])
	// invia messaggio broadcast
	window.external.SendMessage("CardChange", curdata)
	
	window.external.AddTemplateData("emptyslot", curdata, 1, false)
	// invia messaggio broadcast
	window.external.SendMessage("CardRemoved", curdata)
	
	ReloadPage()
}

function ShowPopup()
{
	// nodo xml su cui si è cliccato col tasto dx
	var node = m_imgToNode[event.srcElement.id]
	if (node == undefined)
		return
	
	var menu
	if (node.nodeName == "switchslot" || node.nodeName == "cpuslot")
		// nessun menu, esce
		return
	else if (node.nodeName == "emptyslot")
		// menu con solo "incolla"
		menu = "emptyslotPopup"
	else
		// menu con copia, incolla, cancella
		menu = "slotPopup"
	
	// mostra il menu
	window.external.TempVar("CurrentSlot") = node
	var ris = window.external.ShowPopupMenu(menu, event.screenX, event.screenY)
	window.external.TempVar("CurrentSlot") = undefined
	
	if (ris)
		// se si è fatto qcosa ricarica la pagina
		ReloadPage()
}

// apre lo slot corrispondente alla scheda avente stato di errore
function SearchErrorBus(datapath)
{
	// ottiene il path COMPLETO del nodo xml in errore, esce se non presente
	var errorPath = window.external.TempVar("ErrorPath")
	if (! errorPath) return
	
	// il path dell'errore deve cominciare con il path dello slot attuale
	if (errorPath.substr(0, datapath.length) != datapath)
		return
		
	// estrae la parte di path del campo in errore
	fieldPath = errorPath.substr(datapath.length)
	if (fieldPath == "") return
	var pos = fieldPath.indexOf("/")
	// estrae il nome del nodo figlio in errore
	var child = fieldPath.substr(0, pos)
	if (child == "") return
	
	// ottiene l'indice della scheda in errore
	var busNode = window.external.SelectNodesXML(datapath.slice(0,-1))[0]
	var errNode = busNode.selectSingleNode(child)
	var index = GetNodeIndex(busNode, errNode)
	if (index == -1) return
	
	ShowSlot(index)
}

function GetNodeIndex(parent, node)
{
	var list = parent.selectNodes("*[@insertable]")
	for (var i = 0; i < list.length; i++)
		if (list[i] == node)
			return i
			
	return -1
}