import censusIntake from '@salesforce/apex/Virtical.APIControllerManager.censusIntake';
import censusValidate from '@salesforce/apex/Virtical.APIControllerManager.censusValidate';
import IconAddUser from '@salesforce/resourceUrl/Virtical__IconAddUser';
import IconMore from '@salesforce/resourceUrl/Virtical__IconMore';
import IconTrash from '@salesforce/resourceUrl/Virtical__IconTrash';
import PlusCircleIcon from '@salesforce/resourceUrl/Virtical__PlusCircleIcon';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { LightningElement, api, track } from 'lwc';

export default class CensusIntake extends LightningElement {
  @api maxFileSize = 5e6;
  @track fileRejections = [];
  @track censusData = [];
  isShowErrorMessage;

  plusCircleSvg = PlusCircleIcon;
  moreSvg = IconMore;
  addUserSvg = IconAddUser;
  trashSvg = IconTrash;

  isDragActive = false;
  loading = false;

  get wrapperStyle() {
    return `background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='rgba(214,214,214)' stroke-width='3' stroke-dasharray='6%2c 10' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`;
  }

  get statistic() {
    return [
      {
        key: "Total Employees",
        value: this.censusData.filter(item => item.employeeId != null).length ?? 0,
      },
      {
        key: "Employee Only",
        value: this.censusData.filter(item => item.employeeId != null && item.dependents == 0).length ?? 0,
      },
      {
        key: "Employee Spouse",
        value: this.countRelationships(this.censusData).spouseCount ?? 0
      },
      {
        key: "Employee Child",
        value: this.countRelationships(this.censusData).childCount ?? 0
      },
      {
        key: "Employee Family",
        value: this.countRelationships(this.censusData).familyCount ?? 0
      },
    ]
  }

  get genderOptions() {
    return [
      { label: '', value: '' },
      { label: 'Male', value: 'Male' },
      { label: 'Female', value: 'Female' },
    ];
  }

  get tobaccoUseOptions() {
    return [
      { label: '', value: '' },
      { label: 'Yes', value: 'Yes' },
      { label: 'No', value: 'No' },
    ];
  }

  get relationshipOptions() {
    return [
      { label: 'Employee', value: 'Employee' },
      { label: 'Spouse', value: 'Spouse' },
      { label: 'Child', value: 'Child' },
    ];
  }

  get formattedMaxSize() {
    const unit = this.getSizeUnit(this.maxFileSize);
    const value = this.formatSizeByUnit(this.maxFileSize, unit);
    return `${value} ${unit}`;
  }

  get payload() {
    return this.transformPayloadFormat(this.censusData);
  }

  countRelationships(censusData) {
    let familyCount = 0;
    let childCount = 0;
    let spouseCount = 0;
  
    for (const employee of censusData) {
      if (employee.relationshipToEmployee === "Employee") {
        const hasSpouse = censusData.some(
          (dependent) => dependent.dependentEmployeeId === employee.employeeId && dependent.relationshipToEmployee === "Spouse"
        );
  
        const hasChild = censusData.some(
          (dependent) => dependent.dependentEmployeeId === employee.employeeId && dependent.relationshipToEmployee === "Child"
        );
  
        if (hasSpouse && hasChild) {
          familyCount++;
        } else if (hasChild && !hasSpouse) {
          childCount++;
        } else if (!hasChild && hasSpouse) {
          spouseCount++;
        }
      }
    }
  
    return { familyCount, childCount, spouseCount };
  }

  transformData(inputData) {
    const transformedData = [];
    const transformDependent = (dependent, employeeId) => {
      return {
        id: transformedData.length + 1,
        age: dependent?.age,
        dob: this.transformDateFormat(dependent.dob),
        employeeId: null,
        name: dependent?.name,
        gender: dependent?.gender,
        zipCode: dependent?.zipCode,
        tobaccoUse: dependent?.tobaccoUse,
        relationshipToEmployee: dependent?.relationshipToEmployee === "Spouse" ? "Spouse" : "Child",
        monthlyPrice: dependent?.monthlyPrice,
        dependents: 0,
        dependentEmployeeId: employeeId,
        isNameError: dependent?.error?.error_field?.includes("name") ?? false,
        isAgeError: dependent?.error?.error_field?.includes("age") ?? false,
        isGenderError: dependent?.error?.error_field?.includes("gender") ?? false,
        isZipCodeError: dependent?.error?.error_field?.includes("zipCode") ?? false,
        isTobaccoUseError: dependent?.error?.error_field?.includes("tobaccoUse") ?? false,
        isRelationshipToEmployeeError: dependent?.error?.error_field?.includes("relationshipToEmployee") ?? false,
      };
    }

    inputData.forEach(employee => {
      const employeeData = {
        id: transformedData.length + 1,
        age: employee.age,
        dob: this.transformDateFormat(employee.dob),
        employeeId: employee.id,
        name: employee.name,
        gender: employee.gender,
        zipCode: employee.zipCode,
        tobaccoUse: employee?.tobaccoUse,
        relationshipToEmployee: "Employee",
        monthlyPrice: employee.monthlyPrice ?? 0,
        dependents: employee.dependents,
        dependentEmployeeId: null,
        isNameError: employee?.error?.error_field?.includes("name") ?? false,
        isAgeError: employee?.error?.error_field?.includes("age") ?? false,
        isGenderError: employee?.error?.error_field?.includes("gender") ?? false,
        isZipCodeError: employee?.error?.error_field?.includes("zipCode") ?? false,
        isTobaccoUseError: employee?.error?.error_field?.includes("tobaccoUse") ?? false,
        isRelationshipToEmployeeError: employee?.error?.error_field?.includes("relationshipToEmployee") ?? false,
      };
  
      transformedData.push(employeeData);
  
      if(employee.dependentsData && employee.dependentsData.length) {
        employee.dependentsData.forEach(dependent => {
          transformedData.push(transformDependent(dependent, employee.id));
        });
      }
    });

    return transformedData;
  }

  handleFileClick() {
    const fileInput = this.template.querySelector("input[type='file']");
    if (fileInput) fileInput.click();
  }

  handleDispatchEvent(name, data) {
    const event = new CustomEvent(name, data);
    this.dispatchEvent(event);
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

  showToast({ message, variant = "error", title = "Error" }) {
    const toastEvent = new ShowToastEvent({
      title,
      message,
      variant
    });
    this.dispatchEvent(toastEvent);
  }

  bytesToMegabytes(bytes) {
    return (bytes / (1024 * 1024)).toFixed(2);
  }

  async handleUploadFile(event) {
    this.loading = true;
    const file = event.detail;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        let base64 = event.target.result;
        base64 = base64.split(",")[1];
        this.retrieveData(base64, file?.name);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      this.showToast({ message: 'An error occurred while uploading the file. Please try again.' });
    }
  }

  async retrieveData(base64, fileName) {
    try {
      const response = await censusIntake({ metadata: 'Census_Intake', file: base64, fileName });
      const { data } = JSON.parse(response);
      const censusData = data.map(item => item.censusData);
      this.censusData = this.transformData(censusData);
    } catch (error) {
      this.showToast({ message: 'An error occurred while fetching data. Please try again.' });
    } finally {
      this.loading = false;
    }
  }

  renderedCallback() {
    if (!this.fileRejections?.length) return
    this.fileRejections.forEach((rejection) => {
      rejection.errors.forEach((error) => {
        this.showToast({ message: error.message });
      });
    });
  }

  handleAddEmployee() {
    this.censusData = this.censusData.map(entry => ({
      ...entry,
      employeeId: entry.employeeId !== null ? entry.employeeId + 1 : null,
      dependentEmployeeId: entry.dependentEmployeeId !== null ? entry.dependentEmployeeId + 1 : null,
    }));

    const newEmployee = {
      id: this.censusData.length + 1,
      employeeId: 1,
      age: "",
      dob: "",
      name: "",
      gender: "Male",
      zipCode: null,
      tobaccoUse: "No",
      relationshipToEmployee: "Employee",
      monthlyPrice: "",
      dependents: 0,
      dependentEmployeeId: null,
    };

    this.censusData.unshift(newEmployee);
  }

  handleAddDependent(event) {
    const id = event.currentTarget.dataset.id;
    const index = this.censusData.findIndex((item) => item.id == id);
    const currentEmployee = this.censusData.find((item) => item.id == id);

    if (index !== -1) {
      const blankRow = {
        id: this.censusData.length + 1,
        employeeId: null,
        age: "",
        name: "",
        dob: "",
        gender: "",
        zipCode: null,
        tobaccoUse: "No",
        relationship: "",
        dependents: 0,
        dependentEmployeeId: currentEmployee.employeeId,
      };

      this.censusData.splice(index + 1, 0, blankRow);
      currentEmployee.dependents += 1;
    }
  }

  handleRemoveDependent(event) {
    const id = event.currentTarget.dataset.id;
    const employeeId = +event.currentTarget.dataset.employeeid;

    if (employeeId) {
      const filteredCensusData = this.censusData.filter((item) => item.employeeId != employeeId && item.dependentEmployeeId != employeeId)

      this.censusData = filteredCensusData.map(entry => ({
        ...entry,
        employeeId: (+entry.employeeId !== null && +entry.employeeId > employeeId) ? +entry.employeeId - 1 : entry.employeeId,
        dependentEmployeeId: (+entry.dependentEmployeeId !== null && +entry.dependentEmployeeId > employeeId) ? +entry.dependentEmployeeId - 1 : entry.dependentEmployeeId,
      }));
    } else {
      const index = this.censusData.findIndex((item) => item.id == id);
      const currentDependent = this.censusData.find((item) => item.id == id);
      const currentEmployee = this.censusData.find((item) => item.employeeId == currentDependent.dependentEmployeeId);
  
      if (index !== -1) {
        this.censusData.splice(index, 1);
        currentEmployee.dependents -= 1;
      }
    }
  }

  handleUpdateInfo(event) {
    const id = event.currentTarget.dataset.id;
    const field = event.currentTarget.dataset.field;
    const value = event.target.value;
    const item = this.censusData.find((item) => item.id == id);
    if (item) {
      item[field] = value;

      if (field === "dob") {
        const dobDate = new Date(value);
        const today = new Date();
        const age = today.getFullYear() - dobDate.getFullYear();
  
        if (
          today.getMonth() < dobDate.getMonth() ||
          (today.getMonth() === dobDate.getMonth() && today.getDate() < dobDate.getDate())
        ) {
          item.age = age - 1;
        } else {
          item.age = age;
        }
      }

      if (field === "age") {
        const currentDate = new Date();
        const birthYear = currentDate.getFullYear() - value;
        item.dob = `${birthYear}-01-01`;
      }
    }
  }

  transformDateFormat(inputDate) {
    const dateObject = new Date(inputDate);
    const year = dateObject.getFullYear();
    const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObject.getDate().toString().padStart(2, '0');
    const transformedDate = `${year}-${month}-${day}`;
  
    return transformedDate;
  }

  transformPayloadFormat(inputData) {
    const employeeMap = new Map();
  
    inputData.forEach((item) => {
      if (item.employeeId !== null) {
        if (!employeeMap.has(item.employeeId)) {
          employeeMap.set(item.employeeId, {
            id: item.employeeId,
            age: item.age,
            dob: item.dob,
            dependents: 0,
            dependentsData: [],
            gender: item.gender,
            monthlyPrice: item.monthlyPrice,
            name: item.name,
            relationshipToEmployee: item.relationshipToEmployee,
            tobaccoUse: item.tobaccoUse,
            zipCode: item.zipCode,
          });
        }
      }
    });
  
    inputData.forEach((item) => {
      if (item.dependentEmployeeId !== null) {
        const employeeData = employeeMap.get(item.dependentEmployeeId);
        if (employeeData) {
          employeeData.dependentsData.push({
            age: item.age,
            dob: item.dob,
            dependents: item.dependents,
            gender: item.gender,
            monthlyPrice: item.monthlyPrice,
            name: item.name,
            relationshipToEmployee: item.relationshipToEmployee,
            tobaccoUse: item.tobaccoUse,
            zipCode: item.zipCode,
          });
          employeeData.dependents += 1;
        }
      }
    });
  
    const transformedData = Array.from(employeeMap.values());
    const result = transformedData.map((item) => ({ censusData: item }));
  
    return result;
  }

  async handleValidateData() {
    this.loading = true;
    try {
      const response = await censusValidate({ metadata: 'Census_Validate', data: JSON.stringify(this.payload) });
      const responseJSON = JSON.parse(response);
      if (!responseJSON.length) return;
      const validatedData = responseJSON.map(item => item.censusData);
      this.censusData = this.transformData(validatedData);
    } catch (error) {
      this.showToast({ message: error });
    } finally {
      this.loading = false;
    }
  }
}