using DragAndDropUploadWithBackendAPI.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Blob;
using Microsoft.Azure;
using Microsoft.WindowsAzure.Storage.Auth;
using System.IO;
using System.Threading.Tasks;
using System.Configuration;

namespace DragAndDropUploadWithBackendAPI.Controllers
{
    public class SasController : ApiController
    {
        string storageAccountName { get; set; }
        string StorageAccountDomain { get; set; }
        string BlobContainerName { get; set; }
        string StorageAccountKey { get; set; }

        public SasController() {
            var appSettings = ConfigurationManager.AppSettings;

            storageAccountName = appSettings["StorageAccountName"];
            StorageAccountDomain = appSettings["StorageAccountDomain"];
            BlobContainerName = appSettings["BlobContainerName"];
            StorageAccountKey = appSettings["StorageAccountKey"];

        }

        public IHttpActionResult GetBlob(string id)
        {
            CloudStorageAccount storageAccount = new CloudStorageAccount(new StorageCredentials(storageAccountName, StorageAccountKey), true);

            CloudBlobClient blobClient = storageAccount.CreateCloudBlobClient();
            //Get a reference to a container to use for the sample code, and create it if it does not exist.
            CloudBlobContainer container = blobClient.GetContainerReference(BlobContainerName);
            container.CreateIfNotExists();
            //TODO: fix it more elegant
            setContainerPolicies(container);

            var blob = container.GetBlockBlobReference(id);
            var sas = blob.GetSharedAccessSignature(policy: new SharedAccessBlobPolicy
            {
                SharedAccessStartTime = DateTimeOffset.Now.Subtract(TimeSpan.FromHours(1)),
                SharedAccessExpiryTime = DateTimeOffset.Now.AddDays(5),
                Permissions =  SharedAccessBlobPermissions.List | SharedAccessBlobPermissions.Write | SharedAccessBlobPermissions.Read
            });
            string uri = "https://" + storageAccountName + "." + StorageAccountDomain + "/" + BlobContainerName + "/" + id + sas;
            Blob sasBlob = new Blob { Name = id, Id = 3, Size = 0, Sas = uri };


            var tempblob = sasBlob;

            if (tempblob == null)
            {
                return NotFound();
            }
            return Ok(tempblob);
        }

        public async Task setContainerPolicies(CloudBlobContainer container)
        {
            SharedAccessBlobPolicy sharedPolicy = new SharedAccessBlobPolicy()
            {
                // When the start time for the SAS is omitted, the start time is assumed to be the time when the storage service receives the request. 
                // Omitting the start time for a SAS that is effective immediately helps to avoid clock skew.
                SharedAccessExpiryTime = DateTime.UtcNow.AddHours(24),
                Permissions = SharedAccessBlobPermissions.Create | SharedAccessBlobPermissions.Read
            };
            // Get the container's existing permissions.
            BlobContainerPermissions permissions = await container.GetPermissionsAsync();
            permissions.SharedAccessPolicies.Add("ACLWR", sharedPolicy);
            await container.SetPermissionsAsync(permissions);
        }


    }
}
