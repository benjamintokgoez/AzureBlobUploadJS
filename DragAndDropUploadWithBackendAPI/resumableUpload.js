(function () {
  
    //START Uploadcode

    //global variables
    var
    //set Debug Mode
    NUMBER_OF_RETRIES = 5,
    debugmode = false;

    function resetAllVars() {
        fileSize = 0;
        currentFilePointer = 0;
        blockSize = 0;
        totalBytesRemaining = 0;
        blockIds = [];
        file["submitUri"] = "";
        bytesUploaded = 0;
        BLOCK_POINTER = 0;
        READED_UNCOMMITTED_BLOCKS = 0;
    }

    //Function to upload data
    function sendAjax(url, dataToSend, headers, successFuction) {
        Rx.DOM.ajax({
            'url': url,
            'method': 'PUT',
            'body': dataToSend,
            'headers': headers
        })
        .retry(NUMBER_OF_RETRIES)
        .subscribe(
            function (xhr) {
                successFuction(xhr);
            },
            function (xhr, desc, err) {
               
                if (xhr.status === 403) {
                    progressbarFunction.text("Access denied, the assigned upload time has been exeeded");
                } else {
                    
                        console.log("Retrying transmission");

                    }
                    progressbarFunction("Error occured: " + desc);
                    console.log(desc);
                    console.log(err);    
                     }
                
            
    );
    }
    /*
    contentMD5: contentHash,

                        accessCondition: AccessCondition.GenerateEmptyCondition(),

                        options: new BlobRequestOptions

                        {

                            StoreBlobContentMD5 = true,

                            UseTransactionalMD5 = true

                        },

    paralleler Upload von Chunks 
    */
    function uploadFileInBlocks(file) {
        if (file["totalBytesRemaining"] > 0) {
            if (debugmode) {
                console.log("current file pointer = " + file["currentFilePointer"] + " bytes read = " + file["blocksize"]);
            }
            var slice = file["selectedFile"].slice(file["currentFilePointer"], file["currentFilePointer"] + file["blocksize"]);
            var blockId = file["BLOCK_ID_PREFIX"] + padToSixDigits(file["blockIds"].length + file["BLOCK_POINTER"], 6);
            if (debugmode) {
                console.log("block id = " + blockId);
            }
            file["blockIds"].push(btoa(blockId));
            if (debugmode) {
                console.log("blockId " + blockId);
                console.log("btoa blockid " + btoa(blockId));
            }
            file["reader"].onloadend = (function (file) {
                return function (e) {
                    uploadFileinChunks(e, file);

                }
            })(file);
            file["reader"].readAsArrayBuffer(slice);
            file["currentFilePointer"] += file["blocksize"];
            file["totalBytesRemaining"] -= file["blocksize"];
            if (file["totalBytesRemaining"] < file["blocksize"]) {
                file["blocksize"] = file["totalBytesRemaining"];
            }
        } else {
            commitBlockList(file, file["blockIds"], file["selectedFile"].type);
        }
    }
    function padToSixDigits(number) {
        return ("000000" + number).substr(-6);
    }

    function commitBlockList(file, blockIdList, contentType) {
        var uri = file["submitUri"] + '&comp=blocklist';
        if (debugmode) {
            console.log(uri);
        }
        var requestBody = '<?xml version="1.0" encoding="utf-8"?><BlockList>';
        for (var j = 0; j < file["BLOCK_POINTER"]; j++) {
            requestBody += '<Latest>' + btoa(file["BLOCK_ID_PREFIX"] + padToSixDigits(j, 6)) + '</Latest>';
        }
        for (var i = 0; i < blockIdList.length; i++) {
            requestBody += '<Latest>' + blockIdList[i] + '</Latest>';
        }
        requestBody += '</BlockList>';
        if (debugmode) {
            console.log(requestBody);
        }
        sendAjax(uri,
            requestBody,
            {
                'Content-Type': 'x-ms-blob-content-type'
            },
            function (data, status) {
                if (data.status === 201) {
                    console.log("Status: success");
                    progressbarFunction("Done!")
                    //reset all changed Values
                    //resetAllVars();
                }
                
            });

    }

    function getBlockList() {
        Rx.DOM.ajax({ url: file["submitUri"] + "&comp=blocklist&blocklisttype=all ", responseType: 'text' })
        .subscribe(
            function (data) {

                var serverResponse = data.response;

                if (window.DOMParser) {
                    parser = new DOMParser();
                    xmlDoc = parser.parseFromString(serverResponse, "text/xml");
                }
                else {
                    error.log("DOM Parser not available");
                }
                file["BLOCK_POINTER"] = $(xmlDoc).find("Block").length;
                return file["BLOCK_POINTER"];

            },
            function (error) {
                // Log the error
                console.log("GetBlockListError: " + error);
            }
            );
        
    }
    function getUncommittedBlockList(file) {
        handleFileSelect(file);
        Rx.DOM.ajax({ url: file["submitUri"] + "&comp=blocklist&blocklisttype=uncommitted ", responseType: 'text' })
        .subscribe(
            function (data) {

                var serverResponse = data.response;
                if(data.status === 404){
                    console.log("Blob does not exist yet.");

                }
                if (debugmode) {
                    console.log(serverResponse);
                }

                if (window.DOMParser) {
                    parser = new DOMParser();
                    xmlDoc = parser.parseFromString(serverResponse, "text/xml");
                }
                else {

                    error.log("DOM Parser not available");
                }
                file["BLOCK_POINTER"] = $(xmlDoc).find("Block").length;
                if (debugmode) {
                    console.log("block pointer = " + file["BLOCK_POINTER"]);
                }
                file["currentFilePointer"] += file["BLOCK_POINTER"] * file["MAX_BLOCK_SIZE"];
                file["bytesUploaded"] += file["currentFilePointer"];
                file["totalBytesRemaining"] = file["fileSize"] - file["currentFilePointer"];
                file["READED_UNCOMMITTED_BLOCKS"] = file["BLOCK_POINTER"];

                uploadFileInBlocks(file);

            },
            function (error) {
                // better with tryandcatch
                console.log("Blob does not exist yet.");
                file["BLOCK_POINTER"] = 0;
                if (debugmode) {
                    console.log("block pointer = " + file["BLOCK_POINTER"]);
                }
                file["currentFilePointer"] += file["BLOCK_POINTER"] * file["MAX_BLOCK_SIZE"];
                file["bytesUploaded"] += file["currentFilePointer"];
                file["totalBytesRemaining"] = file["fileSize"] - file["currentFilePointer"];
                file["READED_UNCOMMITTED_BLOCKS"] = file["BLOCK_POINTER"];

                uploadFileInBlocks(file);
            }
            );
    }
    

    //Upload file in chunks when FileReader is ready
    function uploadFileinChunks(evt, file) {
        var uri = file["submitUri"] + '&comp=block&blockid=' + file["blockIds"][file["blockIds"].length - 1];

        var requestData = new Uint8Array(evt.target.result);
        sendAjax(uri,
            requestData,
            {
                'BlockBlob': 'x-ms-blob-type'
            },
            function (data, status) {
                if (debugmode) {
                    console.log("FileDroppedStatus" + data.status);
                }
                file["bytesUploaded"] += requestData.length;
                var percentComplete = ((parseFloat(file["bytesUploaded"]) / parseFloat(file["selectedFile"].size)) * 100).toFixed(2);
                progressbarFunction(percentComplete + " %");
                uploadFileInBlocks(file);
            });
    }

    function handleFileSelect(file) {
        file["fileSize"] = file["selectedFile"].size;
        file["blocksize"] = Math.min(file["fileSize"], file["MAX_BLOCK_SIZE"]);
        if (debugmode) {
            console.log("total blocks = " + Math.ceil(file["fileSize"] / file["blocksize"]));
            console.log(file["submitUri"]);
        }
    }
    

    //Start Upload-Pipeline
    function startUpload(file, sas) {
        var fileObj = createFileObject(file);
        updateFileSelectUI(fileObj); //UI Component
        sas(fileObj);
        
    }

    function createFileObject(file) {
        var fileObj = {
            selectedFile : file,
            fileSize : 0,
            currentFilePointer : 0,
            blockSize : 0,
            totalBytesRemaining : 0,
            blockIds : [],
            submitUri : "",
            bytesUploaded : 0,
            MAX_BLOCK_SIZE : 256 * 1024,
            BLOCK_ID_PREFIX : "block-",
            RETRY_TIMEOUT_SECONDS : 5,
            NUMBER_OF_RETRIES : 3,
            BLOCK_POINTER : 0,
            READED_UNCOMMITTED_BLOCKS: 0,
            reader : new FileReader()
        }

        return fileObj;
    }
    //END Uploadcode

    //START custom code. UI, SAS, Progressbar
    
    $(document).ready(function () {
        initUiAndUpload(getSasUrl, setUIComponent, setProgressBarComponent);

    });

    var uri = 'api/sas';
    function formatItem(item) {
        return item.Sas;
    }
    function getSasUrl(file) {
        var name = file["selectedFile"].name.split('.').join("");
        var sasUrl = "";
        Rx.DOM.ajax({ url: uri +'/'+name, responseType: 'json' })
        .subscribe(
            function (data) {

                file["submitUri"] = sasUrl = formatItem(data.response);
                if (debugmode) {
                    console.log("SasUrl: " + sasUrl);
                }
                getUncommittedBlockList(file);

            },
            function (error) {
            // Log the error
            console.log("Sas_Error" + error);
            }
            );

        return sasUrl;
    }

    function updateFileSelectUI(file) {
        file["fileSize"] = file["selectedFile"].size;
        $('#output').removeClass('hidden');
        $("#fileName").text(file["selectedFile"].name);
        $("#fileSize").text(file["fileSize"]);
        $("#fileType").text(file["selectedFile"].type);
    }

    function setUIComponent(sas) {

        if (window.File && window.FileReader && window.FileList && window.Blob) {

            var $form = $('.box');
            if (true) {
                $form.addClass('has-advanced-upload');
            }
            var droppedFiles = false;

            $form.on('drag dragstart dragend dragover dragenter dragleave drop', function (e) {
                e.preventDefault();
                e.stopPropagation();
            })
                .on('dragover dragenter', function () {
                    $form.addClass('is-dragover');
                })
                .on('dragleave dragend drop', function () {
                    $form.removeClass('is-dragover');
                })
                .on('drop', function (e) {
                    droppedFiles = e.originalEvent.dataTransfer.files;
                    for (i = 0; i < droppedFiles.length; i++) {
                        startUpload(droppedFiles[i], sas); //Start upload pipeline
                    }

                    
                });
        }
        else {
            window.alert('The File APIs are not fully supported in this browser.');
            $("#file").prop('disabled', true);
            return 0;

        }
    }

    function setProgressBarComponent(text) {
        $("#fileUploadProgress").text(text);

        return null;
    }
    //END customcode

    var progressbarFunction;

    // init functions
    function initUiAndUpload(sas, ui, progressbar) {
        progressbarFunction = progressbar;
        ui(sas);
    }

})();