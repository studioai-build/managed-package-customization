import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class UploadDocument extends LightningElement {
  @api inputDescription = "Maximum upload file size: 5MB. Only accepts the file extension: .pdf";
  @api fileType = "pdf";
  @api maxFileSize = 5e6;
  @track fileRejections = [];

  isDragActive = false;
  loading = false;
  get description() {
    return this.inputDescription;
  }

  get type() {
    return `.${this.fileType}`;
  }

  get hasError() {
    return this.fileRejections?.length;
  }

  get formattedMaxSize() {
    const unit = this.getSizeUnit(this.maxFileSize);
    const value = this.formatSizeByUnit(this.maxFileSize, unit);
    return `${value} ${unit}`;
  }

  get strokeColor() {
    if (this.isDragActive) {
      return 'rgb(33,150,243)';
    }
    if (this.hasError) {
      return 'rgb(248,113,113)';
    }
    return 'rgba(214,214,214)';
  }

  get wrapperStyle() {
    return `background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='${this.strokeColor}' stroke-width='3' stroke-dasharray='6%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`;
  }

  handleFileClick() {
    const fileInput = this.template.querySelector("input[type='file']");
    if (fileInput) {
      fileInput.click();
    }
  }

  handleDispatchEvent(name, data) {
    const event = new CustomEvent(name, data);
    this.dispatchEvent(event);
  }

  setLoading(loading) {
    this.handleDispatchEvent("setloading", { detail: loading })
  }

  setError(err) {
    this.handleDispatchEvent("seterror", { detail: err })
  }

  setData(data) {
    this.handleDispatchEvent("setdata", { detail: data })
  }

  async uploadFile(file) {
    const isReject = this.handleFileRejections(file);

    if (isReject || this.loading) return;
    this.handleDispatchEvent("fetch", { detail: file })
  }

  handleFileRejections(file) {
    this.fileRejections = [];
    let rejection = false;

    if (file.size > this.maxFileSize) {
      this.fileRejections.push({
        file,
        errors: [{
          code: 'file-too-large',
          message: `File is larger than ${this.formattedMaxSize}`
        }]
      });
      rejection = true;
    }

    return rejection;
  }

  getSizeUnit = (bytes = 0) => {
    if (typeof bytes !== "number") return "";

    switch (true) {
      case (bytes >= 1000000000):
        return "GB";
      case (bytes >= 1000000):
        return "MB";
      case (bytes >= 1000):
        return "KB";
      default:
        return "B";
    }
  }

  formatSizeByUnit = (bytes, unit, toFixed = 2) => {
    if (typeof bytes !== "number") return 0;

    const values = {
      GB: (bytes / 1000000000).toFixed(toFixed),
      MB: (bytes / 1000000).toFixed(toFixed),
      KB: (bytes / 1000).toFixed(toFixed),
      B: (bytes).toFixed(toFixed),
    };

    return Number(values[unit]) ?? 0;
  }

  handleDragEnter(e) {
    e.preventDefault();
    this.isDragActive = true;
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.isDragActive = false;
  }

  handleDragOver(e) {
    e.preventDefault();
  }

  handleDragEnd(e) {
    e.preventDefault();
    this.isDragActive = false;
  }

  handleDragDrop(e) {
    e.preventDefault();
    this.isDragActive = false;
    const file = e.dataTransfer.files[0];
    this.uploadFile(file);
  }

  handleUploadFile(e) {
    const file = e.target.files[0];
    this.uploadFile(file);
  }

  showToast({ message, variant = "error", title = "Error" }) {
    const toastEvent = new ShowToastEvent({
      title,
      message,
      variant
    });
    this.dispatchEvent(toastEvent);
  }

  renderedCallback() {
    if (!this.fileRejections?.length) return
    this.fileRejections.forEach((rejection) => {
      rejection.errors.forEach((error) => {
        this.showToast({ message: error.message });
      });
    });
  }
}