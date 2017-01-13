using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace DragAndDropUploadWithBackendAPI.Models
{
    public class Blob
    {

        public string Name { get; set; }
        public int Id { get; set; }
        public long Size { get; set; }
        public string Sas {get; set; }
    }
}