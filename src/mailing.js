import sgMail from '@sendgrid/mail';

const client = require('@sendgrid/client');

if (process.env.SENDGRID_API_KEY) {
  client.setApiKey(process.env.SENDGRID_API_KEY);
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const profileToContact = (profile, contactId) => {
  let contact = {};
  if (profile) {
    contact = { email: profile.email, custom_fields: { e1_T: profile.id } };
    const name = profile.name && profile.name.trim();
    if (name && name.length && name.length < 50) {
      const split = name.trim().split(' ');
      [contact.first_name] = split;
      const lastName = split.slice(1).join(' ');
      if (lastName.length) {
        contact.last_name = lastName;
      }
    }
  }
  if (contactId) {
    contact.id = contactId;
  }
  return contact;
};

export const addUserToContacts = (profile, lists, contactId) => {
  const request = {
    method: 'PUT',
    url: '/v3/marketing/contacts',
    body: {
      list_ids: lists || undefined,
      contacts: [profileToContact(profile, contactId)],
    },
  };
  return client.request(request);
};

export const removeUserFromList = (list, contactId) => {
  const request = {
    method: 'DELETE',
    url: `/v3/marketing/lists/${list}/contacts?contact_ids=${contactId}`,
  };
  return client.request(request);
};

export const removeUserContact = (contactId) => {
  const request = {
    method: 'DELETE',
    url: `/v3/marketing/contacts?ids=${contactId}`,
  };
  return client.request(request);
};

export const getContactIdByEmail = async (email) => {
  if (email) {
    const request = {
      method: 'POST',
      url: '/v3/marketing/contacts/search',
      body: {
        query: `email = '${email}'`,
      },
    };
    const [, body] = await client.request(request);
    if (body && body.result && body.result.length) {
      return body.result[0].id;
    }
  }
  return null;
};

export const updateUserContact = async (newProfile, oldEmail, lists) => {
  const contactId = await getContactIdByEmail(oldEmail);
  return addUserToContacts(newProfile, lists, contactId);
};

export const sendEmail = async (data) => {
  if (process.env.SENDGRID_API_KEY) {
    await sgMail.send(data);
  }
};
