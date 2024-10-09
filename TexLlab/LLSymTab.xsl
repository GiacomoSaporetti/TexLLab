<?xml version="1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns="http://www.w3.org/1999/xhtml">
    <xsl:output  method="html" indent="yes" omit-xml-declaration="yes"
        media-type="application/xhtml+xml"
        encoding="ISO-8859-1" doctype-public="-//W3C//DTD XHTML 1.0 transitional//EN"
        doctype-system="http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"/>

    <xsl:template match="/">
        <html>
        <head>
        <title><xsl:value-of select="LLSymbolTable/@Name"/> symbol table</title>
        <meta http-equiv="content-type" content="application/xhtml+xml; charset=iso-8859-1"/>
        <style type="text/css">
            .TestoTabella {  font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 12px; color: #000000; border-color: black black #003399; border-style: solid; }
        </style>
        </head>
        <body>
        <h4 align="center">SYMBOL TABLE OF <xsl:value-of select="LLSymbolTable/@Name"/></h4>
        
        <!-- Resource -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
			<tr>
				<th colspan="2" align="left">RESOURCE:</th>
			</tr>
			<tr bgcolor="#71A3FF">
				<th>Name</th>
				<th>Processor</th>
			</tr>
			<tr bgcolor="#CCCCCC">
				<td align="left"><xsl:value-of select="LLSymbolTable/Resource/@Name" /></td>
				<td align="left"><xsl:value-of select="LLSymbolTable/Resource/@Proc" /></td>
			</tr>
        </table>
        </p>
        
        <!-- Case-sensitivity -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
			<tr>
				<th align="left">CASE-SENSITIVE:</th>
			</tr>
			<tr bgcolor="#CCCCCC">
				<td align="left"><xsl:value-of select="LLSymbolTable/CaseSensitive" /></td>
			</tr>
        </table>
        </p>
        
        <!--TASKS-->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th  colspan="2" align="left">TASKS:</th>
            </tr>
            <tr colspan="2" bgcolor="#71A3FF">
                <th>Name</th>
                <th>Program</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/Tasks/Task">
                <tr  bgcolor="#CCCCCC">
                    <td align="left">
                        <xsl:value-of select="@Name"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@Program"/>
                    </td>
                </tr>
            </xsl:for-each>
        </table>
        </p>
        
        <!-- Data blocks -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th colspan="4" align="left" >DATA BLOCKS:</th>
            </tr>
            <tr bgcolor="#71A3FF">
                <th align="left">Imgc</th>
                <th align="left">Type</th>
                <th align="left">ID</th>
                <th align="left">Addr</th>
                <th align="left">No. el</th>
                <th align="left">Size</th>
                <th align="left">R/W</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/DataBlocks/DBlock">
                <tr bgcolor="#CCCCCC">
                    <td align="left">
                        <xsl:value-of select="@Imgc"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@Type"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@DbId"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@Addr"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@NEl"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@DataSize"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@RW"/>
                    </td>
                </tr>
            </xsl:for-each>
        </table>
        </p>
        
        <!-- Global variables -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th colspan="4" align="left" >GLOBAL VARIABLES:</th>
            </tr>
            <tr bgcolor="#71A3FF">
                <th align="left">Name</th>
                <th align="left">Type</th>
                <th align="left">Addr</th>
                <th align="left">Dims</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/GlobalVars/Var">
            <tr bgcolor="#CCCCCC">
                <td align="left">
                    <xsl:value-of select="@Name"/>
                </td>
                <td align="left">
                    <xsl:value-of select="@Type"/>
                </td>
                <td align="left">
                    <xsl:value-of select="@Addr"/>
                </td>
                <td align="left">
                    <xsl:value-of select="@Dims"/>
                </td>
            </tr>
            </xsl:for-each>
            <!-- Constants -->
            <tr bgcolor="#FFFF80">
                <th colspan="4" align="left">Constants:</th>
            </tr>
            <tr bgcolor="#71A3FF">
                <th align="left">Name</th>
                <th align="left">Type</th>
                <th align="left">Value</th>
                <th align="left">Dims</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/GlobalVars/Const">
			<tr bgcolor="#CCCCCC">
                <td align="left">
                    <xsl:value-of select="@Name"/>
                </td>
                <td align="left">
                    <xsl:value-of select="@Type"/>
                </td>
                <td align="left">
                    <xsl:value-of select="."/>
                </td>
                <td align="left">
                    <xsl:value-of select="@Dims"/>
                </td>
            </tr>
            </xsl:for-each>
        </table>
        </p>
		
        <!-- Programs -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th align="left" colspan="4">PROGRAMS:</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/Programs/Prog">
                <tr bgcolor="#FFB66C">
                    <th colspan="5" align="left">
                        <xsl:value-of select="@Name"/>
                    </th>
                </tr>
                <tr bgcolor="#AEDF9D">
                    <th align="left" width="30" bgcolor="#FFFFFF"></th>
                    <th colspan="4" align="left">
                        CodeAddress:
                        <xsl:value-of select="@CodeAddr"/>
                    </th>
                </tr>
                <tr bgcolor="#71A3FF">
                    <th align="left" width="30" bgcolor="#FFFFFF"></th>
                    <th align="left">Name</th>
                    <th align="left">Type</th>
                    <th align="left">Addr</th>
                    <th align="left">Dims</th>
                </tr>
                <xsl:for-each select="Var">
                <tr bgcolor="#CCCCCC">
                    <td align="left" width="30" bgcolor="#FFFFFF"></td>
                    <td align="left">
                        <xsl:value-of select="@Name"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@Type"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@Addr"/>
                    </td>
                    <td align="left">
                        <xsl:value-of select="@Dims"/>
                    </td>
                </tr>
                </xsl:for-each>
            </xsl:for-each>
        </table>
        </p>

        <!-- FunctionBlocks -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th align="left" colspan="4">FUNCTION BLOCKS:</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/FunctionBlocks/FBlock">
                <tr bgcolor="#FFB66C">
                    <th colspan="5" align="left" >
                        <xsl:value-of select="@Name"/>
                    </th>
                </tr>
                <tr>
                    <th width="30" bgcolor="#FFFFFF"></th>
                    <th colspan="4" align="left" bgcolor="#AEDF9D">
                      FrameSize:
                        <xsl:value-of select="@FrameSize"/>
                        <br>
                        </br>
                        CodeAddress:
                        <xsl:value-of select="@CodeAddr"/>
                    </th>
                </tr>
                <tr bgcolor="#71A3FF">
                    <th  width="30" bgcolor="#FFFFFF"></th>
                    <th align="left">Name</th>
                    <th align="left">Type</th>
                    <th align="left">Addr</th>
                    <th align="left">Dims</th>
                </tr>
                <xsl:for-each select="*">
                    <tr bgcolor="#CCCCCC">
                        <td width="30" bgcolor="#FFFFFF"></td>
                        <td align="left">
                            <xsl:value-of select="@Name"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Type"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Addr"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Dims"/>
                        </td>
                    </tr>
                </xsl:for-each>
            </xsl:for-each>
        </table>
        </p>
         
        <!-- Functions -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th align="left" colspan="5">FUNCTIONS:</th>
            </tr>
            <xsl:for-each select="LLSymbolTable/Functions/Fun">
                <tr bgcolor="#FFB66C">
                    <th colspan="5" align="left" >
                        <xsl:value-of select="@Name"/>
                    </th>
                </tr>
                <tr bgcolor="#AEDF9D">
                    <th width="30" bgcolor="#FFFFFF"></th>
                    <th colspan="4" align="left" >
                        CodeAddress
                        <xsl:value-of select="@CodeAddr"/>
                    </th>
                </tr>
                <tr bgcolor="#71A3FF">
                    <th bgcolor="#FFFFFF"></th>
                    <th align="left">Name</th>
                    <th align="left">Type</th>
                    <th align="left">Addr</th>
                    <th align="left">Dims</th>
                </tr>
                <xsl:for-each select="*">
                    <tr width="30" bgcolor="#CCCCCC">
                        <td bgcolor="#FFFFFF"></td>
                        <td align="left">
                            <xsl:value-of select="@Name"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Type"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Addr"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Dims"/>
                        </td>
                    </tr>
                </xsl:for-each>
            </xsl:for-each>
        </table>
        </p>
        
        <!-- Structures -->
        <p>
        <table bgcolor="#ffffff" border="0" class="TestoTabella">
            <tr >
                <th align="left" colspan="4">STRUCTURES:</th>
            </tr>

            <xsl:for-each select="LLSymbolTable/Structures/Stru">
                <tr bgcolor="#FFB66C">
                    <th colspan="5" align="left" >
                        <xsl:value-of select="@Name"/>
                    </th>
                </tr>
                <tr bgcolor="#AEDF9D">
                    <th  width="30" bgcolor="#FFFFFF"></th>
                    <th colspan="5" align="left">
                    Size:
                        <xsl:value-of select="@Size"/>
                    </th>
                </tr>
                <tr bgcolor="#71A3FF">
                    <th  width="30" bgcolor="#FFFFFF"></th>
                    <th align="left">Name</th>
                    <th align="left">Type</th>
                    <th align="left">Offs</th>
                    <th align="left">Dims</th>
                </tr>
                <xsl:for-each select="*">
                    <tr bgcolor="#CCCCCC">
                        <td align="left" width="30" bgcolor="#FFFFFF"></td>
                        <td align="left">
                            <xsl:value-of select="@Name"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Type"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Addr"/>
                        </td>
                        <td align="left">
                            <xsl:value-of select="@Dims"/>
                        </td>
                    </tr>
                </xsl:for-each>
            </xsl:for-each>
        </table>
        </p>
        
        </body>
        </html>
    </xsl:template>
</xsl:stylesheet>