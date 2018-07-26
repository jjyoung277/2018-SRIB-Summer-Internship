/**
 * Track the trade of a commodity from one trader to another
 * @param {org.example.mynetwork.Save} data - the data of image
 * @transaction
 */
async function saveMetaData(data) {
  var factory = getFactory();
  var newImageMetaData = factory.newResource('org.example.mynetwork', 'ImageMetaData', data.imageMetaData.imageName);
  newImageMetaData.owner = data.imageMetaData.owner;
  newImageMetaData.size = data.imageMetaData.size;
  newImageMetaData.lastModifiedTime = data.imageMetaData.lastModifiedTime;
  newImageMetaData.description = data.imageMetaData.description;
  newImageMetaData.downloader = new Array();
  let doctorRegistry = await getParticipantRegistry('org.example.mynetwork.Doctor');
  let doctor = await doctorRegistry.get(data.imageMetaData.provider.doctorId);
  newImageMetaData.provider = doctor;
  newImageMetaData.expired = false;
  
  
  let patientRegistry = await getParticipantRegistry('org.example.mynetwork.Patient');
  
  let patient = await patientRegistry.get(data.imageMetaData.owner.id);
  if(patient.images) {
    await patient.images.push(newImageMetaData);
  }
  else {
    patient.images = new Array();
    patient.images.push(newImageMetaData);
  }
  patientRegistry.update(patient);

  return getAssetRegistry('org.example.mynetwork.ImageMetaData')
    .then(function(imageMetadataRegistry){
    return imageMetadataRegistry.add(newImageMetaData);
  });
}

/**
 * Track the trade of a commodity from one trader to another
 * @param {org.example.mynetwork.Read} read - the reader of image
 * @transaction
 */
async function readMetaData(read) {
  
  let imageRegistry = await getAssetRegistry('org.example.mynetwork.ImageMetaData');
  let image = await imageRegistry.get(read.imageMetaData.imageName);
  
  	
  let doctorRegistry = await getParticipantRegistry('org.example.mynetwork.Doctor');
  let doctor = await doctorRegistry.get(read.downloader.doctorId);
  image.downloader.push(doctor);
  imageRegistry.update(image);

  let patientRegistry = await getParticipantRegistry('org.example.mynetwork.Patient');
  let patient = await patientRegistry.get(read.patient.id);
  if(patient.images) {
    for(var i=0; i<patient.images.length; i++)
      if(patient.images[i].imageName == read.imageMetaData.imageName)
        patient.images[i] = image;
    }
    else {
      patient.images = new Array();
      await patient.images.push(image);
    }
    patientRegistry.update(patient);
}

/**
 * Set image to expired image
 * @param {org.example.mynetwork.Expire} expire - image to expire
 * @transaction
 */
async function setExpire(expire) {
  expire.imageMetaData.expired = true;
  let assetRegistry = await getAssetRegistry('org.example.mynetwork.ImageMetaData');
  await assetRegistry.update(expire.imageMetaData);
}

/**
 * Create ID to blockchain network
 * @param {org.example.mynetwork.CreateDoctor} createDoctor - doctor to add
 * @transaction
 */
async function registerDoctor(createDoctor) {
      var factory = getFactory();
      var newDoctor = factory.newResource('org.example.mynetwork', 'Doctor', createDoctor.doctorId);
      newDoctor.doctorName = createDoctor.doctorName;
      newDoctor.phone = createDoctor.phone;

      return getParticipantRegistry('org.example.mynetwork.Doctor')
        .then(function(doctorRegistry) {
            return doctorRegistry.add(newDoctor);
      });
}

/**
 * Create ID to blockchain network
 * @param {org.example.mynetwork.CreatePatient} createPatient - patient to add
 * @transaction
 */
async function registerPatient(createPatient) {
  var factory = getFactory();
  var newPatient = factory.newResource('org.example.mynetwork', 'Patient', createPatient.id);
  newPatient.images = new Array();
 // newPatient.images = null;
  return getParticipantRegistry('org.example.mynetwork.Patient')
  	.then(function(patientRegistry) {
    	return patientRegistry.add(newPatient);
  });
}
