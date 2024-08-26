import getPlanComparison from '@salesforce/apex/Virtical.APIControllerManager.getPlanComparison';
import ICON_CHECK from '@salesforce/resourceUrl/Virtical__IconCheck';
import ICON_CHECK_GREEN from '@salesforce/resourceUrl/Virtical__IconCheckGreen';
import ICON_EXCLAMATION from '@salesforce/resourceUrl/Virtical__IconExclamation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { LightningElement, track } from 'lwc';

export default class PlanComparison extends LightningElement {
  @track data = [];
  loading = false;
  checkSvg = ICON_CHECK;
  checkGreenSvg = ICON_CHECK_GREEN;
  exclamationSvg = ICON_EXCLAMATION;
  isShowErrorMessage;

  setLoading(loading) {
    this.loading = loading;
  }

  setData(data) {
    if (!data) return;
    const benefitKeys = this.getBenefitKeys(data);
    this.data = [benefitKeys, { Name: data.plan.Name, benefits: data.plan.benefits }, ...data.recommendation];
  }

  capitalizeFirstCharacter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getBenefitKeys(data) {
    const plan = data.plan.benefits;

    const transformedData = {
      Name: "",
      benefits: plan.map(item => ({
        key: item.key,
        title: item.title,
        value: item.title
      }))
    };

    return transformedData;
  }

  showToast({ message, variant = "error", title = "Error" }) {
    const toastEvent = new ShowToastEvent({
      title,
      message,
      variant
    });
    this.dispatchEvent(toastEvent);
  }

  async uploadFile(e) {
    this.setLoading(true);
    const file = e.detail;
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        let base64PDF = event.target.result;
        base64PDF = base64PDF.split(",")[1];
        this.retrieveData(base64PDF);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      this.showToast({ message: 'An error occurred while uploading the file. Please try again.' });
    }
  }

  async retrieveData(pdfBase64Content) {
    try {
      const response = await getPlanComparison({ metadata: 'Plan_Comparison', pdfBase64Content });
      this.setData(JSON.parse(response));
    } catch (error) {
      this.showToast({ message: 'An error occurred while fetching data. Please try again.' });
    } finally {
      this.setLoading(false);
    }
  }
}