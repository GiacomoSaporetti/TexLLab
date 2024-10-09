
//----------------------------	COPIA DI L:\Test\Axel\Common\Extensions\Common.js	----------------
function SplitCommString(commstring)
{
	var conf = {}
	
	// posizione del primo : dopo il protocollo
	var protocolNameSep = commstring.indexOf(":")
	conf.protocol = commstring.substr(0, protocolNameSep)
	
	// posizione del # prima del tipo porta
	var protocolPortSep = commstring.indexOf("#", protocolNameSep+1)
	var protocolStr = commstring.substr(protocolNameSep+1, protocolPortSep-protocolNameSep-1)
	var list = protocolStr.split(",")
	conf.address = list[0]
	conf.timeout = list[1]
	conf.protocolOptions = list[2]
	
	// posizione del secondo : dopo il tipo porta
	var portNameSep = commstring.indexOf(":", protocolPortSep)
	conf.portType = commstring.substr(protocolPortSep+1, portNameSep-protocolPortSep-1)
	
	var portStr = commstring.substr(portNameSep+1)
	switch (conf.portType)
	{
		case "COM":
		case "RSUSBX":
		case "CANUSB":
		case "CANPC":
			list = portStr.split(",")
			conf.portNum = list[0]
			conf.baud = list[1]
			
			// posizione della lineconf in fondo
			var baudSep = portNameSep + conf.portNum.length + 1 + conf.baud.length + 2
			conf.lineConf = commstring.substr(baudSep)
			break
			
		case "TCPIP":
			if (conf.protocol == "ModbusTCP" ||
				conf.protocol == "HDPCLink" ||
				conf.protocol == "GDB" )
			{
				if (conf.protocol == "ModbusTCP")
					conf.slaveAddr = conf.address
				
				list = portStr.split(",")
				
				var portSep = list[0].lastIndexOf("/")
				if (portSep != -1)
				{
					conf.address = list[0].substr(0, portSep)
					conf.portNum = list[0].substr(portSep+1)
				}
				
				if (list.length > 1)
					conf.lineConf = list[1]
			}
			else
				conf.portNum = portStr
			break
			
		case "CANUSBX":
		case "CANUSBX2":
			list = portStr.split(",")
			conf.portNum = list[0]
			conf.baud = list[1]
			break
			
		case "CAN":
			conf.baud = portStr
			break
	}
	
	return conf
}

function InitPage()
{
	if(document.getElementById("CommString"))
	{
		var conf = SplitCommString(document.getElementById("CommString").innerText);
		if(conf)
		{
			for (var property in conf)
			{
				var ctrl = document.getElementById("CommString_" + property);
				if(ctrl)
					ctrl.innerText = conf[property];
			}			
		}
	}
}
