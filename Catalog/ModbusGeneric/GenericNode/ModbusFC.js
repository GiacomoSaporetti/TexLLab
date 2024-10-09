
function Init(p)
{
	return 1
}

function UpgradeNode(device, oldversion)
{
	var xmldoc = app.GetXMLDocument()
	
	if (oldversion < 2.0)
	{
		// aggiunge FC_config/turnAround   (default 0)
		var parent = device.selectSingleNode("FC_config")
		parent.appendChild(xmldoc.createElement("turnAround")).text = 0
	}
	
		//aggiunto attributo per agganciare una variabile che permette l'invio oneshot
	if (oldversion < 3.0)
	{
		// aggiunge FC_config/oneshot 
		var parent = device.selectSingleNode("FC_config")
		parent.appendChild(xmldoc.createElement("oneshot")).text = ''
	}
}
