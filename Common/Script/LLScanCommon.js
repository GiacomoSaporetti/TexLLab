
// --------------------------------------- GESTIONE LLSCan ----------------------------------

function LLScanResult(CSV)
{
    this.CSV = CSV;
    this.uniqueId = null;
    this.protocol = null;
    this.commType = null;
    this.address = null;
    this.portNum = null;
    this.targetID = null;
    this.targetComm = null;
    this.sourceCodeDownloadSupported = null;
    this.codeID = null;
    this.appName = null;
    this.appVerMajor = null;
    this.appVerMinor = null;
    this.setIPSupported = null;
    this.protocolOptions = null
    this.deviceName = null;
    this.deviceVersion = null;

}

LLScanResult.prototype.GetCommString = function ()
{
    return app.CallFunction("common.BuildCommString", this.protocol, this.address, "1000", this.portType, this.portNum, undefined, undefined, this.protocolOptions);
}

LLScanResult.prototype.Parse = function ()
{
    if (!this.CSV)
        return false;

	// esempio risultato reso da LLSCan 2.0
    //"-1385843493,GDB,TCPIP,10.0.0.86,5000,RaspPI_2p2,RaspPI,0,-222933442,LL_RPI_Eca,0,0,1,"
    var targetInfo = this.CSV.split(",");
    if (targetInfo[0])
        this.uniqueId = targetInfo[0]; //-1385843493
    if (targetInfo[1])
        this.protocol = targetInfo[1]; //GDB
    if (targetInfo[2])
        this.portType = targetInfo[2]; //TCPIP
    if (targetInfo[3])
        this.address = targetInfo[3]; //10.0.0.86
    if (targetInfo[4])
        this.portNum = targetInfo[4]; //5000
    if (targetInfo[5])
        this.targetID = targetInfo[5]; //RaspPI_2p2
    if (targetInfo[6])
        this.targetComm = targetInfo[6]; //RaspPI
    if (targetInfo[7])
        this.sourceCodeDownloadSupported = targetInfo[7]; //0
    if (targetInfo[8])
        this.codeID = targetInfo[8]; //-222933442
    if (targetInfo[9])
        this.appName = targetInfo[9]; //LL_RPI_Eca
    if (targetInfo[10])
        this.appVerMajor = targetInfo[10]; //0
    if (targetInfo[11])
        this.appVerMinor = targetInfo[11]; //0
    if (targetInfo[12])
        this.setIPSupported = targetInfo[12]; //1  
    if (targetInfo[13])
        this.protocolOptions = targetInfo[13]; //
	
	return true;
}